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

declare global {
  interface Window {
    electron?: {
      getAppVersion: () => Promise<string>;
      checkForUpdates: () => Promise<UpdateCheckResult>;
      downloadUpdate: (downloadUrl: string) => Promise<DownloadResult>;
    };
    ipcRenderer?: {
      on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
      off: (channel: string, listener?: (...args: any[]) => void) => void;
      send: (channel: string, ...args: any[]) => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
  }
}