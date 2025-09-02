import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { UpdateCheckResult } from '@/types/electron';
import { useUpdateStore } from '@/stores/updateStore';

export function useAutoUpdateCheck() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasCheckedOnStartup = useRef(false);
  const { setHasUpdate, setUpdateInfo, setIsCheckingForUpdates, setLastChecked } = useUpdateStore();

  const checkForUpdates = async (silent = true): Promise<UpdateCheckResult | null> => {
    try {
      if (!window.electron?.checkForUpdates) {
        return null;
      }

      setIsCheckingForUpdates(true);
      const result = await window.electron.checkForUpdates();
      
      setHasUpdate(result.hasUpdate);
      setUpdateInfo(result.latestVersion);
      setLastChecked(new Date());
      setIsCheckingForUpdates(false);
      
      if (result.success && result.hasUpdate && !silent) {
        toast.success(`Update available: Version ${result.latestVersion?.version}`);
      }
      
      return result;
    } catch (error) {
      console.error('Auto update check failed:', error);
      setIsCheckingForUpdates(false);
      if (!silent) {
        toast.error('Failed to check for updates');
      }
      return null;
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