import { create } from 'zustand';
import { VersionInfo } from '@/types/electron.d';

interface UpdateState {
  hasUpdate: boolean;
  updateInfo: VersionInfo | null;
  isCheckingForUpdates: boolean;
  lastChecked: Date | null;
  // Actions
  setUpdateInfo: (updateInfo: VersionInfo | null) => void;
  setHasUpdate: (hasUpdate: boolean) => void;
  setIsCheckingForUpdates: (isChecking: boolean) => void;
  setLastChecked: (date: Date) => void;
  clearUpdate: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  hasUpdate: false,
  updateInfo: null,
  isCheckingForUpdates: false,
  lastChecked: null,
  // Actions
  setUpdateInfo: (updateInfo) => set({ updateInfo, hasUpdate: !!updateInfo }),
  setHasUpdate: (hasUpdate) => set({ hasUpdate }),
  setIsCheckingForUpdates: (isCheckingForUpdates) => set({ isCheckingForUpdates }),
  setLastChecked: (lastChecked) => set({ lastChecked }),
  clearUpdate: () => set({ 
    hasUpdate: false, 
    updateInfo: null
  }),
}));