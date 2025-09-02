import { create } from 'zustand';
import { VersionInfo, DownloadProgress } from '@/types/electron.d';

interface UpdateState {
  hasUpdate: boolean;
  updateInfo: VersionInfo | null;
  isCheckingForUpdates: boolean;
  lastChecked: Date | null;
  // Background download states
  isDownloadingInBackground: boolean;
  downloadProgress: DownloadProgress | null;
  isDownloadComplete: boolean;
  downloadedFilePath: string | null;
  autoDownloadEnabled: boolean;
  // Installation states
  installOnClose: boolean;
  installOnNextLaunch: boolean;
  pendingInstallPath: string | null;
  // Actions
  setUpdateInfo: (updateInfo: VersionInfo | null) => void;
  setHasUpdate: (hasUpdate: boolean) => void;
  setIsCheckingForUpdates: (isChecking: boolean) => void;
  setLastChecked: (date: Date) => void;
  setIsDownloadingInBackground: (isDownloading: boolean) => void;
  setDownloadProgress: (progress: DownloadProgress | null) => void;
  setDownloadComplete: (isComplete: boolean, filePath?: string) => void;
  setAutoDownloadEnabled: (enabled: boolean) => void;
  setInstallOnClose: (install: boolean) => void;
  setInstallOnNextLaunch: (install: boolean) => void;
  setPendingInstallPath: (path: string | null) => void;
  clearUpdate: () => void;
  resetDownloadState: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  hasUpdate: false,
  updateInfo: null,
  isCheckingForUpdates: false,
  lastChecked: null,
  // Background download states
  isDownloadingInBackground: false,
  downloadProgress: null,
  isDownloadComplete: false,
  downloadedFilePath: null,
  autoDownloadEnabled: true,
  // Installation states
  installOnClose: false,
  installOnNextLaunch: false,
  pendingInstallPath: null,
  // Actions
  setUpdateInfo: (updateInfo) => set({ updateInfo, hasUpdate: !!updateInfo }),
  setHasUpdate: (hasUpdate) => set({ hasUpdate }),
  setIsCheckingForUpdates: (isCheckingForUpdates) => set({ isCheckingForUpdates }),
  setLastChecked: (lastChecked) => set({ lastChecked }),
  setIsDownloadingInBackground: (isDownloadingInBackground) => set({ isDownloadingInBackground }),
  setDownloadProgress: (downloadProgress) => set({ downloadProgress }),
  setDownloadComplete: (isDownloadComplete, filePath) => set({ 
    isDownloadComplete, 
    downloadedFilePath: filePath || null,
    isDownloadingInBackground: false,
    downloadProgress: null
  }),
  setAutoDownloadEnabled: (autoDownloadEnabled) => set({ autoDownloadEnabled }),
  setInstallOnClose: (installOnClose) => set({ installOnClose }),
  setInstallOnNextLaunch: (installOnNextLaunch) => set({ installOnNextLaunch }),
  setPendingInstallPath: (pendingInstallPath) => set({ pendingInstallPath }),
  clearUpdate: () => set({ 
    hasUpdate: false, 
    updateInfo: null,
    isDownloadComplete: false,
    downloadedFilePath: null,
    pendingInstallPath: null
  }),
  resetDownloadState: () => set({
    isDownloadingInBackground: false,
    downloadProgress: null,
    isDownloadComplete: false,
    downloadedFilePath: null
  }),
}));