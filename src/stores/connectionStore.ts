import { create } from 'zustand';

interface ConnectionStore {
  isConnected: boolean;
  lastChecked: number; // timestamp of last connection check
  showConnectedMessage: boolean;
  setConnectionStatus: (status: boolean) => void;
  setShowConnectedMessage: (show: boolean) => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  // Default to true, will be updated quickly by the hook
  isConnected: true,
  lastChecked: Date.now(),
  showConnectedMessage: false,
  setConnectionStatus: (status) => 
    set((state) => {
      // Only show connected message if we're transitioning from disconnected to connected
      if (status && !state.isConnected) {
        return {
          isConnected: status,
          lastChecked: Date.now(),
          showConnectedMessage: true
        };
      }
      return {
        isConnected: status,
        lastChecked: Date.now(),
        // Keep showing message if we're disconnected
        showConnectedMessage: !status
      };
    }),
  setShowConnectedMessage: (show) => set({ showConnectedMessage: show })
})); 