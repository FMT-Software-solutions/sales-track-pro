import React, { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { UpdateSettings } from '@/components/settings/UpdateSettings';
import { Download, X } from 'lucide-react';

interface UpdateDrawerProps {
  children: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function UpdateDrawer({
  children,
  isOpen,
  onOpenChange,
}: UpdateDrawerProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent className="h-screen rounded-none pb-20 border-1">
        <div className="mx-auto w-full max-w-4xl border border-b-0 h-screen">
          <DrawerHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Software Updates
                </DrawerTitle>
                <DrawerDescription>
                  Check for and install the latest version of SalesTrack Pro
                </DrawerDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-8 w-8"
                aria-label="Close updates"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DrawerHeader>

          <div className="flex h-full max-w-4xl mx-auto">
            {/* Main Content */}
            <div className="flex-1 overflow-hidden pb-20">
              <div className="h-full p-6 overflow-auto pb-10">
                <UpdateSettings />
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
