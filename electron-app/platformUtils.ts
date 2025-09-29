import os from 'os';

export interface PlatformInfo {
  platform: string;
  architecture: string;
  fileExtension: string;
  installerArgs: string[];
  installType: 'appimage' | 'package';
}

/**
 * Get platform-specific file extension for installers
 */
export function getFileExtension(platform: string): string {
  switch (platform) {
    case 'win32':
      return '.exe';
    case 'darwin':
      return '.dmg';
    case 'linux':
      return '.AppImage';
    default:
      return '';
  }
}

/**
 * Get platform-specific installer arguments for silent installation
 */
export function getInstallerArgs(platform: string): string[] {
  switch (platform) {
    case 'win32':
      return ['/S', '/CLOSEAPPLICATIONS'];
    case 'darwin':
    case 'linux':
    default:
      return [];
  }
}

/**
 * Get platform-specific installer arguments for restart scenarios
 */
export function getInstallerArgsWithRestart(platform: string, execPath: string): string[] {
  switch (platform) {
    case 'win32':
      return ['/S', '/CLOSEAPPLICATIONS', `/RESTARTCOMMANDLINE="${execPath}"`];
    case 'darwin':
    case 'linux':
    default:
      return [];
  }
}

/**
 * Get platform-specific installer arguments for visible installation with restart
 */
export function getVisibleInstallerArgsWithRestart(platform: string, execPath: string): string[] {
  switch (platform) {
    case 'win32':
      // Remove /S flag to make installation visible, keep restart functionality
      return ['/CLOSEAPPLICATIONS', `/RESTARTCOMMANDLINE="${execPath}"`];
    case 'darwin':
    case 'linux':
    default:
      return [];
  }
}

/**
 * Get current platform information
 */
export function getPlatformInfo(): PlatformInfo {
  const platform = process.platform;
  const architecture = os.arch();
  let installType: 'appimage' | 'package' = 'package';
  if (process.env.APPIMAGE) {
    installType = 'appimage';
  }
  return {
    platform,
    architecture,
    fileExtension: getFileExtension(platform),
    installerArgs: getInstallerArgs(platform),
    installType,
  };
}

/**
 * Generate platform-specific filename for updates
 */
export function generateUpdateFileName(version: string, platform?: string): string {
  const targetPlatform = platform || process.platform;
  const extension = getFileExtension(targetPlatform);
  return `update-${version}${extension}`;
}

/**
 * Check if platform supports silent installation
 */
export function supportsSilentInstall(platform: string): boolean {
  return platform === 'win32';
}