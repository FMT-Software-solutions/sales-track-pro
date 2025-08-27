import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface MockData {
  provisioningSecret: string;
  organizationDetails: {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  userDetails: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  };
  productId: string;
  appName: string;
}

const TestCreateOwner: React.FC = () => {
  const [endpoint, setEndpoint] = useState('');
  const [requestData, setRequestData] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [responseType, setResponseType] = useState<'success' | 'error' | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  // Generate a proper UUID for organization ID
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (
      c
    ) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const mockData: MockData = {
    provisioningSecret: 'c3bf1337-55e0-4a58-b316-7a95c98bbdbd',
    organizationDetails: {
      id: generateUUID(),
      name: 'Acme Food Corp',
      email: 'admin@acmefood.com',
      phone: '+1-555-0123',
      address: '123 Main Street, Anytown, ST 12345',
    },
    userDetails: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@acmefood.com',
      password: 'TempPass123!',
    },
    productId: 'food-track-pro',
    appName: 'Food Track Pro',
  };

  const loadMockData = () => {
    setRequestData(JSON.stringify(mockData, null, 2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate JSON
    let parsedData;
    try {
      parsedData = JSON.parse(requestData);
    } catch (error) {
      setResponse(`Invalid JSON format: ${(error as Error).message}`);
      setResponseType('error');
      return;
    }

    setIsLoading(true);

    try {
      // If endpoint is provided, make direct HTTP request
      if (endpoint.trim()) {
        const response = await fetch(`${endpoint}/functions/v1/create-owner`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify(parsedData),
        });

        const responseText = await response.text();
        let responseData;

        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = responseText;
        }

        if (!response.ok) {
          setResponse(
            `HTTP ${response.status} ${
              response.statusText
            }\n\nResponse Body:\n${JSON.stringify(
              responseData,
              null,
              2
            )}\n\nRaw Response:\n${responseText}`
          );
          setResponseType('error');
        } else {
          setResponse(
            `Success!\n\nResponse:\n${JSON.stringify(responseData, null, 2)}`
          );
          setResponseType('success');
        }
      } else {
        // Use Supabase client
        const { data, error } = await supabase.functions.invoke(
          'create-owner',
          {
            body: parsedData,
          }
        );

        if (error) {
          // Get more detailed error information
          const errorDetails = {
            message: error.message,
            name: error.name,
            context: error.context,
            details: error.details || 'No additional details available',
          };

          const responseText = `Error: ${
            error.message
          }\n\nFull Error Details:\n${JSON.stringify(
            errorDetails,
            null,
            2
          )}\n\nRaw Error Object:\n${JSON.stringify(error, null, 2)}`;
          setResponse(responseText);
          setResponseType('error');
        } else {
          const responseText = `Success!\n\nResponse:\n${JSON.stringify(
            data,
            null,
            2
          )}`;
          setResponse(responseText);
          setResponseType('success');
        }
      }
    } catch (error) {
      // Capture more details about the caught error
      const errorObj = error as any;
      const errorDetails = {
        message: errorObj.message || 'Unknown error',
        name: errorObj.name || 'Unknown',
        stack: errorObj.stack || 'No stack trace',
        ...errorObj,
      };

      setResponse(
        `Network/Runtime Error:\n${JSON.stringify(errorDetails, null, 2)}`
      );
      setResponseType('error');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadMockData();
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Test Create Owner Edge Function</CardTitle>
          <CardDescription>
            Test the create-owner edge function with mock data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">Mock Data Available</CardTitle>
              <CardDescription>
                Click the button below to load sample data for testing:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={loadMockData} variant="outline">
                Load Mock Data
              </Button>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="endpoint">
                Edge Function Endpoint (Optional)
              </Label>
              <Input
                id="endpoint"
                type="url"
                placeholder="Leave empty to use project's Supabase client"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                When empty, uses the configured Supabase client from your
                project
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestData">Request Data (JSON)</Label>
              <Textarea
                id="requestData"
                placeholder="Enter JSON request data here..."
                value={requestData}
                onChange={(e) => setRequestData(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                required
              />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Edge Function'
              )}
            </Button>
          </form>

          {response && (
            <Alert
              className={
                responseType === 'success'
                  ? 'border-green-500 bg-green-50'
                  : 'border-red-500 bg-red-50'
              }
            >
              <AlertDescription>
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {response}
                </pre>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TestCreateOwner;
