const { contextBridge, ipcRenderer } = require('electron');

// In development mode, expose environment variables to renderer
// In production mode, Vite bakes these into import.meta.env at build time
const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV

let electronAPI: any = {
  ipcRenderer: {
    send: (channel: string, data: any) => {
      ipcRenderer.send(channel, data);
    },
    on: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (_: any, ...args: any[]) => func(...args));
    },
    once: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.once(channel, (_: any, ...args: any[]) => func(...args));
    },
    off: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, func);
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, func);
    }
  },
  // Update system API
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  downloadUpdate: (downloadUrl: string) => ipcRenderer.invoke('download-update', downloadUrl),
  // Auto-update API
  downloadUpdateToTemp: (downloadUrl: string, fileName: string) => ipcRenderer.invoke('download-update-to-temp', downloadUrl, fileName),
  getDownloadProgress: () => ipcRenderer.invoke('get-download-progress'),
  installAndRestart: (downloadPath: string) => ipcRenderer.invoke('install-and-restart', downloadPath),
  cancelDownload: () => ipcRenderer.invoke('cancel-download')
}

if (isDev) {
  // Development mode: expose environment variables
  const envVariables = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'Not set',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'Not set',
    NODE_ENV: process.env.NODE_ENV || 'development'
  }

  console.log('🔍 Development mode - Environment variables in preload:')
  console.log('VITE_SUPABASE_URL:', envVariables.VITE_SUPABASE_URL ? 'Set' : 'Not set')
  console.log('VITE_SUPABASE_ANON_KEY:', envVariables.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Not set')
  console.log('NODE_ENV:', envVariables.NODE_ENV)

  electronAPI.env = envVariables
} else {
  // Production mode: variables are baked into the build by Vite
  console.log('🔒 Production mode - Using build-time environment variables')
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', electronAPI);

// Listen for messages from the main process
ipcRenderer.on('main-process-message', (_event: any, message: any) => {
  console.log('[Receive Main-process message]:', message);
});

console.log('Preload script loaded!');