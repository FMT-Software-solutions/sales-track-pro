const { app, BrowserWindow, ipcMain, shell, net } = require('electron')
const path = require('path')
const fs = require('fs')

// Load environment variables - DEVELOPMENT ONLY
function loadEnvFile() {
  // Only load .env.local in development mode
  // In production, VITE_ variables are baked into the build by Vite
  if (!app.isPackaged) {
    try {
      const envPath = path.join(__dirname, '../.env.local')
      console.log('🔧 DEVELOPMENT MODE: Loading environment variables from:', envPath)
      
      if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8')
        
        envConfig.split('\n').forEach((line: string) => {
          const match = line.match(/^([^#=]+)=(.*)$/)
          if (match) {
            const key = match[1].trim()
            const value = match[2].trim()
            if (key && value) {
              process.env[key] = value
              console.log(`Loaded env var: ${key}=${value.substring(0, 3)}...`)
            }
          }
        })
      } else {
        console.log('No .env.local file found at:', envPath)
      }
    } catch (error) {
      console.error('Error loading environment file:', error)
    }
  } else {
    console.log('🔒 PACKAGED MODE: Using build-time environment variables (no .env files needed)')
  }
}

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
//
// ├─┬ electron-app/dist
// │ ├── main.js
// │ └── preload.js
// │
const DIST_PATH = app.isPackaged 
  ? path.join(__dirname, '../dist')
  : path.join(__dirname, '../../dist')
const PUBLIC_PATH = app.isPackaged 
  ? path.join((process as any).resourcesPath, 'app', 'public')
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
      devTools: true, // Enable DevTools for debugging packaged app
    },
  })

  // Hide menu bar
  win.setMenuBarVisibility(false)
  win.setMenu(null)

  // Open DevTools for debugging
  win.webContents.openDevTools()

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

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.whenReady().then(() => {
  // Load environment variables before creating window
  loadEnvFile()
  createWindow()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// IPC handlers for update functionality
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-updates', async () => {
  try {
    const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/app_versions?status=eq.published&platform=eq.${process.platform}&select=*&order=created_at.desc&limit=1`;
    
    const response = await new Promise<any>((resolve, reject) => {
      const request = net.request({
        method: 'GET',
        url: url
      });

      request.setHeader('apikey', process.env.VITE_SUPABASE_ANON_KEY || '');
      request.setHeader('Authorization', `Bearer ${process.env.VITE_SUPABASE_ANON_KEY || ''}`);
      request.setHeader('Content-Type', 'application/json');

      let responseData = '';

      request.on('response', (response: any) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP error! status: ${response.statusCode}`));
          return;
        }

        response.on('data', (chunk: any) => {
          responseData += chunk.toString();
        });

        response.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (error) {
            reject(new Error('Failed to parse response JSON'));
          }
        });
      });

      request.on('error', (error: any) => {
        reject(error);
      });

      request.end();
    });

    const versions = response as any[];
    const currentVersion = app.getVersion();
    
    if (Array.isArray(versions) && versions.length > 0) {
      const latestVersion = versions[0];
      const isNewer = compareVersions(latestVersion.version, currentVersion) > 0;
      
      return {
        success: true,
        hasUpdate: isNewer,
        currentVersion,
        latestVersion: isNewer ? latestVersion : null
      };
    }

    return {
      success: true,
      hasUpdate: false,
      currentVersion,
      latestVersion: null
    };
  } catch (error) {
    console.error('Update check failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('download-update', async (_: any, downloadUrl: string) => {
  try {
    // Open the download URL in the default browser
    await shell.openExternal(downloadUrl);
    return {
      success: true,
      error: null
    };
  } catch (error) {
    console.error('Error opening download URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open download URL'
    };
  }
});

// Helper function to compare semantic versions
function compareVersions(version1: string, version2: string): number {
  const v1parts = version1.split('.').map(Number);
  const v2parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
    const v1part = v1parts[i] || 0;
    const v2part = v2parts[i] || 0;
    
    if (v1part > v2part) return 1;
    if (v1part < v2part) return -1;
  }
  
  return 0;
}

// Handle app protocol for deep linking (optional)
if ((process as any).defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('salestrack-pro', process.execPath, [
      path.join(__dirname, '../'),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient('salestrack-pro');
}