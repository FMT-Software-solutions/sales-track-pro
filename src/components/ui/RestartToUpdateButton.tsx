import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUpdateStore } from '@/stores/updateStore'
import { Download, RotateCcw, ChevronDown, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RestartToUpdateButtonProps {
  className?: string;
}

export const RestartToUpdateButton: React.FC<RestartToUpdateButtonProps> = ({ className }) => {
  const {
    isDownloadingInBackground,
    downloadProgress,
    isDownloadComplete,
    downloadedFilePath,
    installOnClose,
    installOnNextLaunch,
    setInstallOnClose,
    setInstallOnNextLaunch
  } = useUpdateStore()
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const handleInstallNow = async () => {
    if (!downloadedFilePath || !window.electron) return
    
    try {
      await window.electron.installAndRestart(downloadedFilePath)
    } catch (error) {
      console.error('Failed to install update:', error)
    }
  }

  const handleInstallOnClose = async () => {
    if (!downloadedFilePath || !window.electron) return
    
    try {
      await window.electron.setInstallOnClose(true, downloadedFilePath)
      setInstallOnClose(true)
      setIsDropdownOpen(false)
    } catch (error) {
      console.error('Failed to set install on close:', error)
    }
  }

  const handleInstallOnNextLaunch = async () => {
    if (!downloadedFilePath || !window.electron) return
    
    try {
      await window.electron.setInstallOnNextLaunch(true, downloadedFilePath)
      setInstallOnNextLaunch(true)
      setIsDropdownOpen(false)
    } catch (error) {
      console.error('Failed to set install on next launch:', error)
    }
  }

  const handleCancelScheduledInstall = async () => {
    if (!window.electron) return
    
    try {
      await window.electron.setInstallOnClose(false)
      await window.electron.setInstallOnNextLaunch(false)
      setInstallOnClose(false)
      setInstallOnNextLaunch(false)
    } catch (error) {
      console.error('Failed to cancel scheduled install:', error)
    }
  }

  // Don't show anything if no download is in progress or complete
  if (!isDownloadingInBackground && !isDownloadComplete) {
    return null
  }

  // Show download progress
  if (isDownloadingInBackground && !isDownloadComplete) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-md", className)}>
        <Download className="h-4 w-4 text-blue-600 animate-pulse" />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-blue-700 font-medium">
            Downloading update...
          </span>
          {downloadProgress && (
            <Progress 
              value={downloadProgress.percent} 
              className="w-24 h-1" 
            />
          )}
        </div>
      </div>
    )
  }

  // Show scheduled install status
  if (isDownloadComplete && (installOnClose || installOnNextLaunch)) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-md", className)}>
        <Clock className="h-4 w-4 text-amber-600" />
        <span className="text-xs text-amber-700 font-medium">
          {installOnClose ? 'Will install on app close' : 'Will install on next launch'}
        </span>
        <Button
          onClick={handleCancelScheduledInstall}
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0 text-amber-600 hover:text-amber-800"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  // Show restart button with dropdown when download is complete
  if (isDownloadComplete) {
    return (
      <div className={className}>
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restart to Update
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleInstallNow}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Install Now
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleInstallOnClose}>
            <Clock className="h-4 w-4 mr-2" />
            Install on App Close
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleInstallOnNextLaunch}>
            <Clock className="h-4 w-4 mr-2" />
            Install on Next Launch
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    )
  }

  return null
}