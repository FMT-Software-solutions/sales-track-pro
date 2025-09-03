import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { UpdateCheckResult } from '@/types/electron.d';
import { useUpdateStore } from '@/stores/updateStore';

export function useAutoUpdateCheck() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasCheckedOnStartup = useRef(false);
  const { 
    setHasUpdate, 
    setUpdateInfo, 
    setIsCheckingForUpdates, 
    setLastChecked
  } = useUpdateStore();



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
        
        // Automatically start download when update is detected
        if (window.electron?.downloadUpdateToTemp) {
          try {
            // Extract filename from URL or use version info
            const url = new URL(result.latestVersion.download_url);
            const fileName = url.pathname.split('/').pop() || `SalesTrack-${result.latestVersion.version}-Setup.exe`;
            
            await window.electron.downloadUpdateToTemp(
              result.latestVersion.download_url,
              fileName
            );
          } catch (error) {
            console.error('Failed to start automatic download:', error);
          }
        }
        
        if (!silent) {
          toast.success('Update available!', {
            description: `Version ${result.latestVersion.version} is being downloaded automatically.`,
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