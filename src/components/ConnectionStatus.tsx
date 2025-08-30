'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Wifi } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useConnectionStore } from '@/stores/connectionStore';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  className?: string;
  message?: string;
  connectedMessage?: string;
  hideDelay?: number;
}

export function ConnectionStatus({
  className = '',
  message = 'Connection lost. Attempting to reconnect...',
  connectedMessage = 'Connection restored',
  hideDelay = 3000, // 3 seconds
}: ConnectionStatusProps) {
  const isConnected = useConnectionStatus();
  const {
    showConnectedMessage,
    setShowConnectedMessage,
  } = useConnectionStore();
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (!isConnected || showConnectedMessage) {
      setShouldRender(true);
      // Small delay to trigger animation
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      // Wait for animation to complete before unmounting
      setTimeout(() => setShouldRender(false), 300);
    }
  }, [isConnected, showConnectedMessage]);

  useEffect(() => {
    if (isConnected && showConnectedMessage) {
      const timer = setTimeout(() => {
        setShowConnectedMessage(false);
      }, hideDelay);
      return () => clearTimeout(timer);
    }
  }, [isConnected, showConnectedMessage, hideDelay, setShowConnectedMessage]);

  // Don't render anything if we're connected and past the show period
  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        'fixed left-1/2 transform -translate-x-1/2 top-4 z-[9999] transition-all duration-300 ease-in-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-5'
      )}
    >
      <Alert
        variant={isConnected ? 'default' : 'destructive'}
        className={cn(
          'bg-gray-50 dark:bg-gray-950/90',
          isConnected
            ? 'border-green-300 dark:border-green-800 text-green-700 dark:text-green-400 bg-transparent'
            : '',
          className
        )}
      >
        <AlertDescription className="flex items-center">
          {isConnected ? (
            <Wifi className="h-4 w-4 mr-2" />
          ) : (
            <AlertCircle className="h-4 w-4 mr-2" />
          )}
          {isConnected ? connectedMessage : message}
        </AlertDescription>
      </Alert>
    </div>
  );
}
