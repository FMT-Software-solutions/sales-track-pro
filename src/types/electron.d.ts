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