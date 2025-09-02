import { create } from 'zustand';
import { VersionInfo } from '@/types/electron';

interface UpdateState {
  hasUpdate: boolean;
  updateInfo: VersionInfo | null;
  isCheckingForUpdates: boolean;
  lastChecked: Date | null;
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
  setUpdateInfo: (updateInfo) => set({ updateInfo, hasUpdate: !!updateInfo }),
  setHasUpdate: (hasUpdate) => set({ hasUpdate }),
  setIsCheckingForUpdates: (isCheckingForUpdates) => set({ isCheckingForUpdates }),
  setLastChecked: (lastChecked) => set({ lastChecked }),
  clearUpdate: () => set({ hasUpdate: false, updateInfo: null }),
}));