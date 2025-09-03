import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useUpdateStore } from '@/stores/updateStore';
import { AutoUpdateResult, DownloadProgress } from '@/types/electron';
import { Download } from 'lucide-react';
import React, { useEffect } from 'react';
import { toast } from 'sonner';

interface RestartToUpdateButtonProps {
  className?: string;
}

export const RestartToUpdateButton: React.FC<RestartToUpdateButtonProps> = ({
  className,
}) => {
  const {
    hasUpdate,
    updateInfo,
    isDownloading,
    downloadProgress,
    isInstalling,
    isDownloadComplete,
    setIsDownloading,
    setDownloadProgress,
    setIsInstalling,
    setIsDownloadComplete,
  } = useUpdateStore();

  // Listen for automatic download events
  useEffect(() => {
    if (!window.electron?.ipcRenderer) return;

    const handleDownloadProgress = (progress: DownloadProgress) => {
      setIsDownloading(true);
      setDownloadProgress(progress);
    };

    const handleDownloadComplete = (result: AutoUpdateResult) => {
      setIsDownloading(false);
      setDownloadProgress(null);
      if (result.success) {
        setIsDownloadComplete(true);
        if (!result.alreadyDownloaded) {
          toast.success('Update available!', {
            description: 'Click "Install Updates" to install and restart.',
            action: {
              label: 'Install Updates',
              onClick: handleInstallUpdates,
            },
          });
        }
      } else {
        toast.error(`Download failed: ${result.error || 'Unknown error'}`);
      }
    };

    window.electron.ipcRenderer.on('download-progress', handleDownloadProgress);
    window.electron.ipcRenderer.on('download-complete', handleDownloadComplete);

    return () => {
      window.electron?.ipcRenderer?.off(
        'download-progress',
        handleDownloadProgress
      );
      window.electron?.ipcRenderer?.off(
        'download-complete',
        handleDownloadComplete
      );
    };
  }, []);

  const handleInstallUpdates = async () => {
    if (!updateInfo || !window.electron) {
      toast.error('Update functionality is not available in this environment.');
      return;
    }

    setIsInstalling(true);

    try {
      // If download is already complete, proceed directly with installation
      if (isDownloadComplete) {
        toast.info('Installing update and restarting app...');

        const installResult = await window.electron.installAndRestart();
        if (installResult.success) {
          toast.success('Installing update and restarting...');
          // App will quit automatically
        } else {
          toast.error(
            `Installation failed: ${installResult.error || 'Unknown error'}`
          );
          setIsInstalling(false);
        }
        return;
      }

      // If download is not complete, start download first
      setIsDownloading(true);
      setDownloadProgress(null);

      // Set up progress listener for manual download
      const handleDownloadProgress = (progress: DownloadProgress) => {
        setDownloadProgress(progress);
      };

      // Set up completion listener for manual download
      const handleDownloadComplete = async (result: AutoUpdateResult) => {
        // Clean up listeners
        window.electron?.ipcRenderer?.off(
          'download-progress',
          handleDownloadProgress
        );
        window.electron?.ipcRenderer?.off(
          'download-complete',
          handleDownloadComplete
        );

        setIsDownloading(false);
        setDownloadProgress(null);

        if (result.success && result.downloadPath) {
          toast.success(
            'Download complete! Installing update and restarting app...'
          );

          // Immediately proceed with installation
          try {
            const installResult = await window.electron!.installAndRestart(
              result.downloadPath
            );
            if (installResult.success) {
              toast.success('Installing update and restarting...');
              // App will quit automatically
            } else {
              toast.error(
                `Installation failed: ${installResult.error || 'Unknown error'}`
              );
              setIsInstalling(false);
            }
          } catch (installError) {
            console.error('Install error:', installError);
            toast.error('An error occurred while installing the update.');
            setIsInstalling(false);
          }
        } else {
          toast.error(`Download failed: ${result.error || 'Unknown error'}`);
          setIsInstalling(false);
        }
      };

      window.electron.ipcRenderer.on(
        'download-progress',
        handleDownloadProgress
      );
      window.electron.ipcRenderer.on(
        'download-complete',
        handleDownloadComplete
      );

      // Extract filename from URL or use version info
      const url = new URL(updateInfo.download_url);
      const fileName =
        url.pathname.split('/').pop() ||
        `SalesTrack-${updateInfo.version}-Setup.exe`;

      toast.info('Starting update download...');

      const result: AutoUpdateResult = await window.electron.downloadUpdateToTemp(
        updateInfo.download_url,
        fileName
      );

      // Check if download started successfully
      if (!result.success) {
        // Clean up listeners if download failed to start
        window.electron.ipcRenderer.off(
          'download-progress',
          handleDownloadProgress
        );
        window.electron.ipcRenderer.off(
          'download-complete',
          handleDownloadComplete
        );
        setIsDownloading(false);
        setDownloadProgress(null);
        setIsInstalling(false);
        toast.error(
          `Failed to start download: ${result.error || 'Unknown error'}`
        );
      }
    } catch (error) {
      console.error('Update error:', error);
      setIsDownloading(false);
      setDownloadProgress(null);
      setIsInstalling(false);
      toast.error('An error occurred while starting the update.');
    }
  };

  // Don't show anything if no update is available
  if (!hasUpdate) {
    return null;
  }

  // Show download progress when downloading
  if (isDownloading) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-md',
          className,
          'hidden'
        )}
      >
        <Download className="h-4 w-4 text-blue-600 animate-pulse" />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-blue-700 font-medium">
            {isInstalling ? 'Installing update...' : 'Downloading update...'}
          </span>
          {downloadProgress && (
            <Progress value={downloadProgress.percent} className="w-24 h-1" />
          )}
        </div>
      </div>
    );
  }

  // Show install updates button when update is available
  if (isDownloadComplete) {
    return (
      <Button
        onClick={handleInstallUpdates}
        size="sm"
        disabled={isDownloading || isInstalling}
        className={cn(
          'border border-green-600 hover:border-green-700 text-green-600 bg-white hover:bg-green-50/60 text-[11px] rounded-full py-0 h-7',
          className
        )}
        title="This will install available updates and restart the app"
      >
        <Download className="h-3 w-3 mr-2" />
        Install Updates
      </Button>
    );
  }

  return null;
};
