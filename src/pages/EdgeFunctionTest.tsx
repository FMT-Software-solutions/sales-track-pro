import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface TestResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

export function EdgeFunctionTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [releaseData, setReleaseData] = useState({
    version: '1.1.0',
    release_notes: 'Test release for Edge Function verification',
    platforms: [
      {
        platform: 'win32',
        architecture: 'x64',
        downloadUrl: 'https://github.com/example/app/releases/download/v1.0.0/app-win32-x64.exe',
        fileSize: 50000000,
        status: 'published',
        isCritical: false,
        minimumVersion: '1.0.0'
      },
      {
        platform: 'darwin',
        architecture: 'x64',
        downloadUrl: 'https://github.com/example/app/releases/download/v1.0.0/app-darwin-x64.dmg',
        fileSize: 45000000,
        status: 'published',
        isCritical: true,
        minimumVersion: '0.9.0'
      },
      {
        platform: 'linux',
        architecture: 'x64',
        downloadUrl: 'https://github.com/example/app/releases/download/v1.0.0/app-linux-x64.AppImage',
        fileSize: 48000000,
        status: 'draft',
        isCritical: false,
        minimumVersion: '1.0.0'
      }
    ],
    status: 'draft',
    is_critical: false,
    minimum_version: '1.0.0',
  });

  const testPublishRelease = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'publish-release',
        {
          body: releaseData,
        }
      );

      const result: TestResult = {
        success: !error,
        data: data,
        error: error?.message,
        timestamp: new Date().toISOString(),
      };

      setTestResults((prev) => [result, ...prev]);

      if (error) {
        toast.error(`Edge Function Error: ${error.message}`);
      } else {
        toast.success('Edge Function called successfully!');
      }
    } catch (err) {
      const result: TestResult = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
      setTestResults((prev) => [result, ...prev]);
      toast.error('Failed to call Edge Function');
    } finally {
      setIsLoading(false);
    }
  };

  const testCheckUpdates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-updates', {
        body: { currentVersion: '1.0.0' },
      });

      const result: TestResult = {
        success: !error,
        data: data,
        error: error?.message,
        timestamp: new Date().toISOString(),
      };

      setTestResults((prev) => [result, ...prev]);

      if (error) {
        toast.error(`Check Updates Error: ${error.message}`);
      } else {
        toast.success('Check Updates function called successfully!');
      }
    } catch (err) {
      const result: TestResult = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
      setTestResults((prev) => [result, ...prev]);
      toast.error('Failed to call Check Updates function');
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Edge Function Test</h1>
          <p className="text-muted-foreground">
            Test Supabase Edge Functions for release management
          </p>
        </div>
        <Badge variant="outline">Development Tool</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Test Controls</CardTitle>
            <CardDescription>
              Configure and execute Edge Function tests
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={releaseData.version}
                onChange={(e) =>
                  setReleaseData((prev) => ({
                    ...prev,
                    version: e.target.value,
                  }))
                }
                placeholder="1.1.0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="releaseNotes">Release Notes</Label>
              <Textarea
                id="releaseNotes"
                value={releaseData.release_notes}
                onChange={(e) =>
                  setReleaseData((prev) => ({
                    ...prev,
                    release_notes: e.target.value,
                  }))
                }
                placeholder="Enter release notes..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Platforms</Label>
              <div className="space-y-2">
                {releaseData.platforms.map((platform, index) => (
                  <div key={index} className="bg-gray-50 p-3 rounded">
                    <div><strong>Platform:</strong> {platform.platform}</div>
                    <div><strong>Architecture:</strong> {platform.architecture}</div>
                    <div><strong>Download URL:</strong> {platform.downloadUrl}</div>
                    <div><strong>File Size:</strong> {platform.fileSize} bytes</div>
                    <div><strong>Status:</strong> {platform.status}</div>
                    <div><strong>Is Critical:</strong> {platform.isCritical ? 'Yes' : 'No'}</div>
                    <div><strong>Minimum Version:</strong> {platform.minimumVersion}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Input
                id="status"
                value={releaseData.status}
                onChange={(e) =>
                  setReleaseData((prev) => ({
                    ...prev,
                    status: e.target.value,
                  }))
                }
                placeholder="draft"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Button
                onClick={testPublishRelease}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Testing...' : 'Test Publish Release'}
              </Button>

              <Button
                onClick={testCheckUpdates}
                disabled={isLoading}
                variant="outline"
                className="w-full"
              >
                {isLoading ? 'Testing...' : 'Test Check Updates'}
              </Button>

              <Button
                onClick={clearResults}
                variant="destructive"
                className="w-full"
              >
                Clear Results
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>Results from Edge Function calls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {testResults.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No test results yet. Run a test to see results here.
                </p>
              ) : (
                testResults.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={result.success ? 'default' : 'destructive'}
                      >
                        {result.success ? 'Success' : 'Error'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {result.error && (
                      <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        <strong>Error:</strong> {result.error}
                      </div>
                    )}

                    {result.data && (
                      <div className="text-sm bg-green-50 p-2 rounded">
                        <strong>Response:</strong>
                        <pre className="mt-1 text-xs overflow-x-auto">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Edge Function Documentation</CardTitle>
          <CardDescription>
            Information about available Edge Functions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold">publish-release</h4>
              <p className="text-sm text-muted-foreground">
                Publishes release information to the app_versions table. Used by
                the release automation system.
              </p>
              <code className="text-xs bg-gray-100 p-1 rounded">
                Body:{' '}
                {JSON.stringify({
                  version: 'string',
                  release_notes: 'string',
                  platforms: [{ platform: 'string', architecture: 'string', downloadUrl: 'string', fileSize: 'number' }],
                  status: 'draft|published',
                })}
              </code>
            </div>

            <div>
              <h4 className="font-semibold">check-updates</h4>
              <p className="text-sm text-muted-foreground">
                Checks for available updates by comparing the current version
                with the latest published version.
              </p>
              <code className="text-xs bg-gray-100 p-1 rounded">
                Body: {JSON.stringify({ currentVersion: 'string' })}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default EdgeFunctionTest;
