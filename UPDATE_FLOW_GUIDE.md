# Complete Update Flow Implementation Guide

This guide provides a comprehensive overview of how the automatic update system works in this Electron application. You can use this guide to implement the same update flow in another application.

## Overview

The update system consists of several key components working together:

1. **Backend Update Service** - Checks for updates and manages downloads
2. **Frontend UI Components** - Display update status and controls
3. **State Management** - Coordinates update state across components
4. **Automatic Update Checking** - Periodically checks for updates
5. **Type Definitions** - Ensures type safety across the system

## Architecture

### 1. Main Process (Electron Backend)

#### File: `electron-app/main.ts`

The main process handles all update operations:

```typescript
// Key IPC handlers for update operations
ipcMain.handle('check-for-updates', async () => {
  // Check for updates from server
  // Return update information if available
});

ipcMain.handle('download-update-to-temp', async (event, downloadUrl, fileName) => {
  // Download update file to temporary directory
  // Emit progress events during download
  // Return download result
});

ipcMain.handle('install-and-restart', async () => {
  // Install downloaded update
  // Restart application
});
```

**Key Features:**
- Non-blocking download process
- Progress reporting via IPC events
- Automatic app restart after installation
- Error handling and recovery

### 2. Type Definitions

#### File: `src/types/electron.d.ts`

```typescript
interface AutoUpdateResult {
  updateAvailable: boolean;
  version?: string;
  download_url?: string;
  release_notes?: string;
  file_size?: number;
  published_at?: string;
  alreadyDownloaded?: boolean; // Indicates if update is already downloaded
}

interface Window {
  electron: {
    checkForUpdates: () => Promise<AutoUpdateResult>;
    downloadUpdateToTemp: (downloadUrl?: string, fileName?: string) => Promise<DownloadResult>;
    installAndRestart: () => Promise<InstallResult>;
    // ... other methods
  };
}
```

### 3. State Management

#### File: `src/stores/updateStore.ts`

```typescript
import { create } from 'zustand';

interface UpdateState {
  updateInfo: AutoUpdateResult | null;
  isDownloading: boolean;
  downloadProgress: number;
  isInstalling: boolean;
  isDownloadComplete: boolean;
  setUpdateInfo: (info: AutoUpdateResult | null) => void;
  setIsDownloading: (downloading: boolean) => void;
  setDownloadProgress: (progress: number) => void;
  setIsInstalling: (installing: boolean) => void;
  setIsDownloadComplete: (complete: boolean) => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  updateInfo: null,
  isDownloading: false,
  downloadProgress: 0,
  isInstalling: false,
  isDownloadComplete: false,
  setUpdateInfo: (info) => set({ updateInfo: info }),
  setIsDownloading: (downloading) => set({ isDownloading: downloading }),
  setDownloadProgress: (progress) => set({ downloadProgress: progress }),
  setIsInstalling: (installing) => set({ isInstalling: installing }),
  setIsDownloadComplete: (complete) => set({ isDownloadComplete: complete }),
}));
```

### 4. Automatic Update Checking

#### File: `src/hooks/useAutoUpdateCheck.ts`

```typescript
import { useEffect } from 'react';
import { useUpdateStore } from '../stores/updateStore';
import { toast } from './use-toast';

export const useAutoUpdateCheck = () => {
  const { setUpdateInfo, setIsDownloading, setDownloadProgress, setIsDownloadComplete } = useUpdateStore();

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const result = await window.electron.checkForUpdates();
        
        if (result.updateAvailable) {
          setUpdateInfo(result);
          
          // If update is already downloaded, mark as complete
          if (result.alreadyDownloaded) {
            setIsDownloadComplete(true);
            toast({
              title: "Update Ready",
              description: `Version ${result.version} is ready to install.`,
            });
          } else {
            // Automatically start download
            setIsDownloading(true);
            setDownloadProgress(0);
            
            const fileName = result.download_url?.split('/').pop() || 'update.exe';
            await window.electron.downloadUpdateToTemp(result.download_url, fileName);
          }
        }
      } catch (error) {
        console.error('Auto update check failed:', error);
      }
    };

    // Check immediately on mount
    checkForUpdates();
    
    // Set up periodic checking (every 30 minutes)
    const interval = setInterval(checkForUpdates, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Listen for download progress events
  useEffect(() => {
    const handleDownloadProgress = (event: any, progress: number) => {
      setDownloadProgress(progress);
    };

    const handleDownloadComplete = (event: any, success: boolean) => {
      setIsDownloading(false);
      if (success) {
        setIsDownloadComplete(true);
        toast({
          title: "Download Complete",
          description: "Update downloaded successfully. Ready to install.",
        });
      } else {
        toast({
          title: "Download Failed",
          description: "Failed to download update. Please try again.",
          variant: "destructive",
        });
      }
    };

    window.electron.ipcRenderer.on('download-progress', handleDownloadProgress);
    window.electron.ipcRenderer.on('download-complete', handleDownloadComplete);

    return () => {
      window.electron.ipcRenderer.removeListener('download-progress', handleDownloadProgress);
      window.electron.ipcRenderer.removeListener('download-complete', handleDownloadComplete);
    };
  }, []);
};
```

### 5. UI Components

#### File: `src/components/settings/UpdateSettings.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useUpdateStore } from '../../stores/updateStore';
import { toast } from '../../hooks/use-toast';

const UpdateSettings: React.FC = () => {
  const {
    updateInfo,
    isDownloading,
    downloadProgress,
    isInstalling,
    isDownloadComplete,
    setUpdateInfo,
    setIsDownloading,
    setDownloadProgress,
    setIsInstalling,
    setIsDownloadComplete,
  } = useUpdateStore();

  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);

  // Listen for download events
  useEffect(() => {
    const handleDownloadProgress = (event: any, progress: number) => {
      setIsDownloading(true);
      setDownloadProgress(progress);
    };

    const handleDownloadComplete = (event: any, success: boolean) => {
      setIsDownloading(false);
      if (success) {
        setIsDownloadComplete(true);
        toast({
          title: "Download Complete",
          description: "Update downloaded successfully. Ready to install.",
        });
      } else {
        setIsDownloadComplete(false);
        toast({
          title: "Download Failed",
          description: "Failed to download update. Please try again.",
          variant: "destructive",
        });
      }
    };

    window.electron.ipcRenderer.on('download-progress', handleDownloadProgress);
    window.electron.ipcRenderer.on('download-complete', handleDownloadComplete);

    return () => {
      window.electron.ipcRenderer.removeListener('download-progress', handleDownloadProgress);
      window.electron.ipcRenderer.removeListener('download-complete', handleDownloadComplete);
    };
  }, []);

  const checkForUpdates = async () => {
    setIsCheckingForUpdates(true);
    try {
      const result = await window.electron.checkForUpdates();
      setUpdateInfo(result);
      
      if (result.updateAvailable) {
        if (result.alreadyDownloaded) {
          setIsDownloadComplete(true);
        }
        toast({
          title: "Update Available",
          description: `Version ${result.version} is available.`,
        });
      } else {
        toast({
          title: "No Updates",
          description: "You are running the latest version.",
        });
      }
    } catch (error) {
      toast({
        title: "Update Check Failed",
        description: "Failed to check for updates. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingForUpdates(false);
    }
  };

  const installUpdate = async () => {
    if (isDownloadComplete) {
      // Update is already downloaded, proceed with installation
      setIsInstalling(true);
      try {
        await window.electron.installAndRestart();
      } catch (error) {
        setIsInstalling(false);
        toast({
          title: "Installation Failed",
          description: "Failed to install update. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      // Need to download first
      setIsDownloading(true);
      setDownloadProgress(0);
      
      try {
        const fileName = updateInfo?.download_url?.split('/').pop() || 'update.exe';
        await window.electron.downloadUpdateToTemp(updateInfo?.download_url, fileName);
      } catch (error) {
        setIsDownloading(false);
        toast({
          title: "Download Failed",
          description: "Failed to download update. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Update check button */}
      <button
        onClick={checkForUpdates}
        disabled={isCheckingForUpdates}
        className="btn btn-primary"
      >
        {isCheckingForUpdates ? 'Checking...' : 'Check for Updates'}
      </button>

      {/* Update available alert */}
      {updateInfo?.updateAvailable && (
        <div className="alert">
          <h3>Update Available: Version {updateInfo.version}</h3>
          <p>File size: {formatFileSize(updateInfo.file_size)}</p>
          <p>Released: {formatDate(updateInfo.published_at)}</p>
          
          {/* Release notes */}
          <div className="release-notes">
            <h4>Release Notes:</h4>
            <div className="scrollable-content">
              {updateInfo.release_notes}
            </div>
          </div>

          {/* Install/Download button */}
          <button
            onClick={installUpdate}
            disabled={isDownloading || isInstalling}
            className="btn btn-primary"
          >
            {isInstalling
              ? 'Installing...'
              : isDownloading
              ? `Downloading... ${downloadProgress}%`
              : isDownloadComplete
              ? 'Install Updates'
              : 'Download & Install Updates'
            }
          </button>
        </div>
      )}
    </div>
  );
};
```

#### File: `src/components/ui/RestartToUpdateButton.tsx`

```typescript
import React from 'react';
import { useUpdateStore } from '../../stores/updateStore';
import { Button } from './button';

const RestartToUpdateButton: React.FC = () => {
  const {
    updateInfo,
    isDownloading,
    downloadProgress,
    isInstalling,
    isDownloadComplete,
    setIsInstalling,
  } = useUpdateStore();

  const handleInstall = async () => {
    if (isDownloadComplete) {
      setIsInstalling(true);
      try {
        await window.electron.installAndRestart();
      } catch (error) {
        setIsInstalling(false);
        console.error('Installation failed:', error);
      }
    }
  };

  if (!updateInfo?.updateAvailable) {
    return null;
  }

  return (
    <Button
      onClick={handleInstall}
      disabled={!isDownloadComplete || isInstalling}
      variant="default"
      size="sm"
    >
      {isInstalling
        ? 'Installing...'
        : isDownloading
        ? `Downloading... ${downloadProgress}%`
        : isDownloadComplete
        ? 'Install Updates'
        : 'Download & Install Updates'
      }
    </Button>
  );
};

export default RestartToUpdateButton;
```

## Implementation Steps

### Step 1: Set Up Type Definitions

1. Create `electron.d.ts` with all necessary interfaces
2. Define `AutoUpdateResult`, `DownloadResult`, `InstallResult` interfaces
3. Extend `Window` interface with electron methods

### Step 2: Implement Main Process Handlers

1. Add IPC handlers for:
   - `check-for-updates`
   - `download-update-to-temp`
   - `install-and-restart`
2. Implement progress reporting via IPC events
3. Handle file downloads and installations

### Step 3: Create State Management

1. Set up Zustand store for update state
2. Include states for:
   - Update information
   - Download progress
   - Installation status
   - Download completion status

### Step 4: Implement Automatic Update Checking

1. Create `useAutoUpdateCheck` hook
2. Set up periodic update checks
3. Handle automatic downloads
4. Listen for download progress events

### Step 5: Build UI Components

1. Create `UpdateSettings` component for manual checks
2. Create `RestartToUpdateButton` for quick access
3. Implement progress indicators
4. Add toast notifications

### Step 6: Integration

1. Add `useAutoUpdateCheck` to main app component
2. Include update components in settings and layout
3. Test the complete flow

## Key Features

### Automatic Background Updates
- Checks for updates every 30 minutes
- Automatically downloads updates when available
- Shows notifications when updates are ready

### Non-Blocking Downloads
- Downloads happen in background
- Progress is reported in real-time
- App remains fully functional during download

### Smart State Management
- Tracks download completion status
- Prevents redundant downloads
- Coordinates state across components

### User-Friendly Interface
- Clear progress indicators
- Contextual button text
- Toast notifications for status updates

### Error Handling
- Graceful failure recovery
- User feedback on errors
- Retry mechanisms

## Configuration

### Update Check Interval
Modify the interval in `useAutoUpdateCheck.ts`:
```typescript
const interval = setInterval(checkForUpdates, 30 * 60 * 1000); // 30 minutes
```

### Download Location
Configure in main process update handlers to use appropriate temporary directory.

### Update Server
Configure the update check endpoint in your main process handlers.

## Testing

1. **Manual Testing**: Use the "Check for Updates" button
2. **Automatic Testing**: Wait for periodic checks or restart app
3. **Progress Testing**: Monitor download progress indicators
4. **Error Testing**: Test with invalid update URLs
5. **State Testing**: Verify state persistence across app restarts

## Security Considerations

1. **HTTPS Only**: Always use HTTPS for update downloads
2. **Signature Verification**: Verify update file signatures
3. **Checksum Validation**: Validate file integrity
4. **Secure Storage**: Store updates in secure temporary locations

This implementation provides a robust, user-friendly update system that works seamlessly in the background while keeping users informed of progress and status.