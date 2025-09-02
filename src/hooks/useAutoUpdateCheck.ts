import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { UpdateCheckResult, AutoUpdateResult, DownloadProgress } from '@/types/electron.d';
import { useUpdateStore } from '@/stores/updateStore';

export function useAutoUpdateCheck() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasCheckedOnStartup = useRef(false);
  const { 
    setHasUpdate, 
    setUpdateInfo, 
    setIsCheckingForUpdates, 
    setLastChecked,
    setIsDownloadingInBackground,
    setDownloadProgress,
    setDownloadComplete,
    autoDownloadEnabled,
    isDownloadingInBackground,
    isDownloadComplete
  } = useUpdateStore();

  const startBackgroundDownload = async (updateInfo: any) => {
    if (!autoDownloadEnabled || isDownloadingInBackground || isDownloadComplete || !window.electron?.downloadUpdateToTemp) {
      return;
    }

    try {
      setIsDownloadingInBackground(true);
      
      // Set up progress listener
      const handleDownloadProgress = (progress: DownloadProgress) => {
        setDownloadProgress(progress);
      };

      // Set up completion listener
      const handleDownloadComplete = (result: AutoUpdateResult) => {
        // Clean up listeners
        window.electron?.ipcRenderer?.off('download-progress', handleDownloadProgress);
        window.electron?.ipcRenderer?.off('download-complete', handleDownloadComplete);
        
        if (result.success && result.downloadPath) {
          setDownloadComplete(true, result.downloadPath);
          toast.success('Update downloaded!', {
            description: 'Click "Restart to Update" to install the latest version.',
            duration: 5000,
          });
        } else {
          setIsDownloadingInBackground(false);
          setDownloadProgress(null);
          console.error('Background download failed:', result.error);
          toast.error('Download failed', {
            description: result.error || 'Unknown error occurred',
            duration: 5000,
          });
        }
      };

      window.electron.ipcRenderer.on('download-progress', handleDownloadProgress);
      window.electron.ipcRenderer.on('download-complete', handleDownloadComplete);

      // Extract filename from URL
      const url = new URL(updateInfo.download_url);
      const fileName = url.pathname.split('/').pop() || `SalesTrack-${updateInfo.version}-Setup.exe`;

      // Start the download (now non-blocking)
      const result: AutoUpdateResult = await window.electron.downloadUpdateToTemp(
        updateInfo.download_url,
        fileName
      );

      // Check if download started successfully
      if (!result.success) {
        // Clean up listeners if download failed to start
        window.electron.ipcRenderer.off('download-progress', handleDownloadProgress);
        window.electron.ipcRenderer.off('download-complete', handleDownloadComplete);
        setIsDownloadingInBackground(false);
        setDownloadProgress(null);
        console.error('Failed to start background download:', result.error);
        toast.error('Failed to start download', {
          description: result.error || 'Unknown error occurred',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Failed to start background download:', error);
      setIsDownloadingInBackground(false);
      setDownloadProgress(null);
      toast.error('Failed to start download', {
        description: 'An unexpected error occurred',
        duration: 5000,
      });
    }
  };

  const checkForUpdates = async (silent = true): Promise<UpdateCheckResult | null> => {
    if (!silent) {
      setIsCheckingForUpdates(true);
    }

    try {
      if (!window.electron?.checkForUpdates) {
        return null;
      }

      const result = await window.electron.checkForUpdates();
      setLastChecked(new Date());

      if (result.hasUpdate && result.latestVersion) {
        setHasUpdate(true);
        setUpdateInfo(result.latestVersion);
        
        // Start background download automatically on startup (but not on first check)
        if (silent && hasCheckedOnStartup.current) {
          await startBackgroundDownload(result.latestVersion);
        }
        
        if (!silent) {
          toast.success('Update available!', {
            description: `Version ${result.latestVersion.version} is ready to download.`,
          });
        }
      } else {
        setHasUpdate(false);
        setUpdateInfo(null);
        
        if (!silent) {
          toast.info('No updates available', {
            description: 'You are running the latest version.',
          });
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to check for updates:', error);
      
      if (!silent) {
        toast.error('Failed to check for updates', {
          description: 'Please try again later.',
        });
      }
      
      return null;
    } finally {
      if (!silent) {
        setIsCheckingForUpdates(false);
      }
    }
  };

  useEffect(() => {
    // Check for updates on app startup (only once)
    if (!hasCheckedOnStartup.current) {
      hasCheckedOnStartup.current = true;
      checkForUpdates(true); // Silent check on startup
    }

    // Set up periodic check every 4 hours
    intervalRef.current = setInterval(() => {
      checkForUpdates(true); // Silent periodic checks
    }, 4 * 60 * 60 * 1000); // 4 hours

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { checkForUpdates };
}