import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { RefreshCw, Download, ExternalLink } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { VersionInfo, UpdateCheckResult } from '@/types/electron';

interface UpdateSettingsProps {
  className?: string;
}

export function UpdateSettings({ className }: UpdateSettingsProps) {
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [lastCheckResult, setLastCheckResult] = useState<
    'success' | 'error' | 'no-update' | null
  >(null);

  useEffect(() => {
    // Get current app version
    if (window.electron?.getAppVersion) {
      window.electron.getAppVersion().then((version: string) => {
        setCurrentVersion(version);
      });
    }

    // Auto-check for updates on component mount if enabled
    if (autoCheckEnabled) {
      checkForUpdates(true); // Silent check
    }

    // Set up periodic auto-check (every 4 hours)
    const interval = setInterval(() => {
      if (autoCheckEnabled) {
        checkForUpdates(true); // Silent check
      }
    }, 4 * 60 * 60 * 1000); // 4 hours

    return () => clearInterval(interval);
  }, [autoCheckEnabled]);

  const checkForUpdates = async (silent = false) => {
    if (!window.electron?.checkForUpdates) {
      if (!silent) {
        toast.error('Update checking is not available in this environment.');
      }
      return;
    }

    setIsChecking(true);
    try {
      const result: UpdateCheckResult = await window.electron.checkForUpdates();
      setLastChecked(new Date());

      if (result.success && result.hasUpdate && result.latestVersion) {
        setUpdateInfo(result.latestVersion);
        setLastCheckResult('success');

        if (!silent) {
          toast.success(
            `Version ${result.latestVersion.version} is now available for download.`
          );
        } else {
          // Show notification for silent checks
          showUpdateNotification(result.latestVersion);
        }
      } else if (result.error) {
        setLastCheckResult('error');
        if (!silent) {
          toast.error(`Failed to check for updates: ${result.error}`);
        }
      } else {
        setUpdateInfo(null);
        setLastCheckResult('no-update');
        if (!silent) {
          toast.success(
            `You're running the latest version (${result.currentVersion}).`
          );
        }
      }
    } catch (error) {
      if (!silent) {
        toast.error('Failed to check for updates. Please try again later.');
      }
    } finally {
      setIsChecking(false);
    }
  };

  const showUpdateNotification = (versionInfo: VersionInfo) => {
    // Create a persistent notification-like toast
    toast.success(
      `🎉 Update Available - Version ${versionInfo.version} is now available.`,
      {
        duration: 10000,
        action: {
          label: 'Download',
          onClick: () => downloadUpdate(versionInfo),
        },
      }
    );
  };

  const downloadUpdate = async (versionInfo: VersionInfo) => {
    if (!window.electron?.downloadUpdate) {
      toast.error(
        'Download functionality is not available in this environment.'
      );
      return;
    }

    setIsDownloading(true);
    try {
      const result = await window.electron.downloadUpdate(
        versionInfo.download_url
      );

      if (result.success) {
        toast.success(
          'The update will open in your default browser. After downloading, please restart the application to apply the update.'
        );
      } else {
        toast.error('Failed to start download. Please try again.');
      }
    } catch (error) {
      toast.error('An error occurred while starting the download.');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatLastChecked = () => {
    if (!lastChecked) return 'Never';
    return lastChecked.toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatReleaseDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Software Updates</CardTitle>
        <CardDescription>
          Check for and install the latest version of SalesTrack Pro
        </CardDescription>
      </CardHeader>
      <Separator className="mt-2 mb-6 bg-gray-300 dark:bg-gray-800" />
      <CardContent className="space-y-6">
        {/* Update Available Alert */}
        {updateInfo && (
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-blue-800 dark:text-blue-200">
                    Version {updateInfo.version} is available
                  </span>
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  >
                    {formatFileSize(updateInfo.file_size)}
                  </Badge>
                </div>

                {updateInfo.release_notes && (
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-1">What's new:</p>
                    <p className="whitespace-pre-wrap">
                      {updateInfo.release_notes}
                    </p>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Button
                    onClick={() => downloadUpdate(updateInfo)}
                    disabled={isDownloading}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isDownloading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Starting Download...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Download Update
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() =>
                      window.open(updateInfo.download_url, '_blank')
                    }
                    variant="outline"
                    size="sm"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in Browser
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Current Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Current Version</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                {currentVersion || '1.0.0'}
              </span>
              {!updateInfo && (
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-600"
                >
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Up to date
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Last Checked</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                {formatLastChecked()}
              </span>
              {lastCheckResult && (
                <div className="flex items-center">
                  {lastCheckResult === 'success' && (
                    <Badge
                      variant="outline"
                      className="text-blue-600 border-blue-600"
                    >
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Update Available
                    </Badge>
                  )}
                  {lastCheckResult === 'no-update' && (
                    <Badge
                      variant="outline"
                      className="text-green-600 border-green-600"
                    >
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Up to Date
                    </Badge>
                  )}
                  {lastCheckResult === 'error' && (
                    <Badge
                      variant="outline"
                      className="text-red-600 border-red-600"
                    >
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Check Failed
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {updateInfo && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Latest Version</span>
              <span className="text-sm text-muted-foreground">
                {updateInfo.version} ({formatReleaseDate(updateInfo.created_at)}
                )
              </span>
            </div>
          )}
        </div>

        {/* Auto-check Setting */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-check" className="text-sm font-medium">
              Automatic Updates
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically check for updates
            </p>
          </div>
          <Switch
            id="auto-check"
            checked={autoCheckEnabled}
            onCheckedChange={setAutoCheckEnabled}
          />
        </div>

        {/* Manual Check Button */}
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => checkForUpdates(false)}
            disabled={isChecking}
            variant="outline"
            size="sm"
          >
            {isChecking ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Check for Updates
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-gray-500">
          {autoCheckEnabled
            ? 'Updates are automatically checked when the app is running.'
            : 'Automatic update checking is disabled. Use the button above to check manually.'}
        </div>
      </CardContent>
    </Card>
  );
}
