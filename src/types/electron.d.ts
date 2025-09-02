export interface VersionInfo {
  id?: number;
  version: string;
  platform: string;
  architecture: string;
  download_url: string;
  file_size: number;
  checksum?: string;
  release_notes?: string;
  status: 'draft' | 'published';
  created_at: string;
  updated_at?: string;
  published_at?: string;
}

export interface UpdateCheckResult {
  success: boolean;
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: VersionInfo | null;
  error: string | null;
}

export interface DownloadResult {
  success: boolean;
  error?: string;
}

export interface DownloadProgress {
  percent: number;
  bytesReceived: number;
  totalBytes: number;
  speed: number; // bytes per second
}

export interface AutoUpdateResult {
  success: boolean;
  error?: string;
  downloadPath?: string;
}

export interface InstallResult {
  success: boolean;
  error?: string;
}

export interface PlatformInfo {
  platform: string;
  architecture: string;
  fileExtension: string;
  installerArgs: string[];
}

export interface UpdateConfig {
  lastChecked: string | null;
  currentVersion: string | null;
  availableUpdate: {
    version: string | null;
    downloadUrl: string | null;
    fileName: string | null;
    fileSize: number | null;
    checksum: string | null;
    releaseNotes: string | null;
  };
  downloadState: {
    isDownloaded: boolean;
    downloadPath: string | null;
    downloadedAt: string | null;
    verified: boolean;
  };
  installPreferences: {
    installOnClose: boolean;
    installOnNextLaunch: boolean;
    installNow: boolean;
    userDecisionPending: boolean;
  };
  cleanup: {
    needsCleanup: boolean;
    lastCleanup: string | null;
    filesToCleanup: string[];
  };
}

declare global {
  interface Window {
    electron?: {
      getAppVersion: () => Promise<string>;
      checkForUpdates: () => Promise<UpdateCheckResult>;
      downloadUpdate: (downloadUrl: string) => Promise<DownloadResult>;
      // Auto-update methods
      downloadUpdateToTemp: (downloadUrl: string, fileName: string) => Promise<AutoUpdateResult>;
      getDownloadProgress: () => Promise<DownloadProgress | null>;
      installAndRestart: (downloadPath: string) => Promise<InstallResult>;
      cancelDownload: () => Promise<{ success: boolean }>;
      // Install preference methods
      setInstallOnClose: (enable: boolean, installPath?: string) => Promise<{ success: boolean }>;
      setInstallOnNextLaunch: (enable: boolean, installPath?: string) => Promise<{ success: boolean }>;
      setInstallNow: (enable: boolean) => Promise<{ success: boolean }>;
      getInstallPreferences: () => Promise<{ installOnClose: boolean; installOnNextLaunch: boolean; pendingInstallPath: string | null }>;
      // Update config methods
      getUpdateConfig: () => Promise<UpdateConfig>;
      // Platform info method
      getPlatformInfo: () => Promise<PlatformInfo>;
      ipcRenderer: {
        on: (channel: string, listener: (...args: any[]) => void) => void;
        off: (channel: string, listener: (...args: any[]) => void) => void;
        once: (channel: string, listener: (...args: any[]) => void) => void;
        send: (channel: string, ...args: any[]) => void;
        removeListener: (channel: string, listener: (...args: any[]) => void) => void;
      };
    };
  }
}