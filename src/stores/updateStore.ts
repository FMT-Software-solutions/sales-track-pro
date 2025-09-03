import { create } from 'zustand';
import { VersionInfo, DownloadProgress } from '@/types/electron.d';

interface UpdateState {
  hasUpdate: boolean;
  updateInfo: VersionInfo | null;
  isCheckingForUpdates: boolean;
  lastChecked: Date | null;
  isDownloading: boolean;
  downloadProgress: DownloadProgress | null;
  isInstalling: boolean;
  isDownloadComplete: boolean;
  // Actions
  setUpdateInfo: (updateInfo: VersionInfo | null) => void;
  setHasUpdate: (hasUpdate: boolean) => void;
  setIsCheckingForUpdates: (isChecking: boolean) => void;
  setLastChecked: (date: Date) => void;
  setIsDownloading: (isDownloading: boolean) => void;
  setDownloadProgress: (progress: DownloadProgress | null) => void;
  setIsInstalling: (isInstalling: boolean) => void;
  setIsDownloadComplete: (isComplete: boolean) => void;
  clearUpdate: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  hasUpdate: false,
  updateInfo: null,
  isCheckingForUpdates: false,
  lastChecked: null,
  isDownloading: false,
  downloadProgress: null,
  isInstalling: false,
  isDownloadComplete: false,
  // Actions
  setUpdateInfo: (updateInfo) => set({ updateInfo, hasUpdate: !!updateInfo }),
  setHasUpdate: (hasUpdate) => set({ hasUpdate }),
  setIsCheckingForUpdates: (isCheckingForUpdates) => set({ isCheckingForUpdates }),
  setLastChecked: (lastChecked) => set({ lastChecked }),
  setIsDownloading: (isDownloading) => set({ isDownloading }),
  setDownloadProgress: (downloadProgress) => set({ downloadProgress }),
  setIsInstalling: (isInstalling) => set({ isInstalling }),
  setIsDownloadComplete: (isDownloadComplete) => set({ isDownloadComplete }),
  clearUpdate: () => set({ 
    hasUpdate: false, 
    updateInfo: null,
    isDownloading: false,
    downloadProgress: null,
    isInstalling: false,
    isDownloadComplete: false
  }),
}));