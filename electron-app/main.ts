import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import https from 'https';
import os from 'os';
import { config } from 'dotenv';

// Check if running in development
const isDev = !app.isPackaged;

let supabaseConfig = {};

// 1. Load from .env in dev
if (process.env.NODE_ENV === "development" || isDev) {
  config(); // loads .env
  supabaseConfig = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  };
} else {
  // 2. Load from config.json in packaged app
  const configPath = path.join((process as any).resourcesPath, "config.json");
  supabaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │
// ├─┬ electron-app/dist
// │ ├── main.js
// │ └── preload.js
// │
const DIST_PATH = app.isPackaged 
  ? path.join(__dirname, '../dist')
  : path.join(__dirname, '../../dist')
const PUBLIC_PATH = app.isPackaged 
  ? path.join((process as any).resourcesPath , 'app', 'public')
  : path.join(__dirname, '../../public')

// Set environment variables
process.env.DIST = DIST_PATH
process.env.PUBLIC = PUBLIC_PATH

// Pass environment variables to renderer process
process.env.VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || ''
process.env.NODE_ENV = process.env.NODE_ENV || 'production'

let win: any = null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// Auto-update state
let currentDownload: any = null
let downloadProgress: any = null
let downloadedFilePath: string | null = null

// Helper function to get temporary download directory
function getTempDownloadPath(): string {
  const tempDir = app.isPackaged 
    ? path.join(os.tmpdir(), 'salestrack-updates')
    : path.join(__dirname, '../../temp-updates')
  
  // Ensure directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  
  return tempDir
}

// Helper function to download file with progress tracking
function downloadFileWithProgress(url: string, filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath)
    
    const request = https.get(url, (response: any) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
        const redirectUrl = response.headers.location
        if (redirectUrl) {
          file.destroy()
          fs.unlinkSync(filePath)
          downloadFileWithProgress(redirectUrl, filePath).then(resolve).catch(reject)
          return
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
        return
      }
      
      const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
      let receivedBytes = 0
      const startTime = Date.now()
      
      downloadProgress = {
        percent: 0,
        bytesReceived: 0,
        totalBytes,
        speed: 0
      }
      
      response.on('data', (chunk: any) => {
        receivedBytes += chunk.length
        const elapsed = (Date.now() - startTime) / 1000
        const speed = elapsed > 0 ? receivedBytes / elapsed : 0
        
        downloadProgress = {
          percent: totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0,
          bytesReceived: receivedBytes,
          totalBytes,
          speed
        }
        
        // Send progress to renderer if window exists
        if (win && !win.isDestroyed()) {
          win.webContents.send('download-progress', downloadProgress)
        }
      })
      
      response.pipe(file)
      
      file.on('finish', () => {
        file.close()
        downloadProgress = null
        resolve({ success: true, downloadPath: filePath })
      })
      
      file.on('error', (err: any) => {
        fs.unlink(filePath, () => {}) // Delete partial file
        downloadProgress = null
        reject(err)
      })
    })
    
    request.on('error', (err: any) => {
      downloadProgress = null
      reject(err)
    })
    
    currentDownload = request
  })
}

// Function to register IPC handlers after environment is loaded
function registerIPCHandlers() {
  // Update system IPC handlers
  ipcMain.handle('check-for-updates', async () => {
    try {
      const currentVersion = app.getVersion();
      const supabaseKey = (supabaseConfig as any).SUPABASE_ANON_KEY;
      
      if (!supabaseKey) {
        console.error('SUPABASE KEY not found');
        return { success: false, error: 'Supabase API key not configured' };
      }
      
      console.log('Checking for updates with version:', currentVersion);
      
      const response = await fetch(`${(supabaseConfig as any).SUPABASE_URL}/functions/v1/check-updates`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platform: process.platform,
          currentVersion: currentVersion
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Update check result:', result);
      return result;
    } catch (error) {
      console.error('Update check failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('download-update', async (_: any, downloadUrl: string) => {
    try {
      await shell.openExternal(downloadUrl);
      return { success: true };
    } catch (error) {
      console.error('Download failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  });

  // Auto-update IPC handlers
  ipcMain.handle('download-update-to-temp', async (_: any, downloadUrl: string, fileName: string) => {
    try {
      if (currentDownload) {
        return { success: false, error: 'Download already in progress' };
      }
      
      const tempDir = getTempDownloadPath();
      const filePath = path.join(tempDir, fileName);
      
      console.log('Starting download to:', filePath);
      const result = await downloadFileWithProgress(downloadUrl, filePath);
      
      if (result.success) {
        downloadedFilePath = filePath;
        console.log('Download completed:', filePath);
      }
      
      currentDownload = null;
      return result;
    } catch (error) {
      console.error('Auto-update download failed:', error);
      currentDownload = null;
      downloadProgress = null;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('get-download-progress', async () => {
    return downloadProgress;
  });

  ipcMain.handle('cancel-download', async () => {
    try {
      if (currentDownload) {
        currentDownload.destroy();
        currentDownload = null;
        downloadProgress = null;
        
        // Clean up partial file if it exists
        if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
          fs.unlinkSync(downloadedFilePath);
          downloadedFilePath = null;
        }
      }
      return { success: true };
    } catch (error) {
      console.error('Cancel download failed:', error);
      return { success: false };
    }
  });

  ipcMain.handle('install-and-restart', async (_: any, downloadPath: string) => {
    try {
      if (!fs.existsSync(downloadPath)) {
        return { success: false, error: 'Downloaded file not found' };
      }
      
      console.log('Installing update from:', downloadPath);
      
      // On Windows, open the installer
      if (process.platform === 'win32') {
        await shell.openPath(downloadPath);
        
        // Give the installer a moment to start, then quit the app
        setTimeout(() => {
          app.quit();
        }, 1000);
        
        return { success: true };
      } else {
        // For other platforms, you might need different logic
        // For now, just open the file
        await shell.openPath(downloadPath);
        app.quit();
        return { success: true };
      }
    } catch (error) {
      console.error('Install and restart failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  });
}



function createWindow() {
  // Determine icon path based on platform
  const iconPath = path.join(app.isPackaged ? PUBLIC_PATH : path.join(__dirname, '../../public'), 
    process.platform === 'win32' ? 'favicon.ico' : 'icon.png')

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools:  !app.isPackaged, // Enable devTools only in development
    },
  })

  // Hide menu bar
  win.setMenuBarVisibility(false)
  win.setMenu(null)

  // Open DevTools in detached mode for debugging
  if(!app.isPackaged) {
    win?.webContents.openDevTools({mode: "detach"})
  }

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // Load the index.html when not in development
    try {
      const indexPath = path.join(DIST_PATH, 'index.html')
      console.log('Loading index.html from:', indexPath)
      
      // Check if the file exists before loading
      if (fs.existsSync(indexPath)) {
        console.log('index.html exists, loading file...')
        win.loadFile(indexPath)
      } else {
        console.error('index.html does not exist at path:', indexPath)
        console.log('Directory contents:', fs.readdirSync(DIST_PATH))
        
        // Try to load from a different location as fallback
        const fallbackPath = path.join(__dirname, '../../dist/index.html')
        if (fs.existsSync(fallbackPath)) {
          console.log('Found index.html at fallback path, loading:', fallbackPath)
          win.loadFile(fallbackPath)
        } else {
          console.error('No index.html found at fallback path either')
          win.webContents.loadFile(path.join(__dirname, 'error.html'))
        }
      }
    } catch (error) {
      console.error('Error loading index.html:', error)
    }
  }
}

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.whenReady().then(() => {
  // Register IPC handlers
  registerIPCHandlers()
  createWindow()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})