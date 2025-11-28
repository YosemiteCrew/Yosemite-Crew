import React, {createContext, useContext, useEffect, useState} from 'react';
import {useNetInfo} from '@react-native-community/netinfo';

export interface NetworkContextType {
  isOnline: boolean;
  sheetRef: React.RefObject<{open: () => void; close: () => void}> | null;
  setNetworkSheetRef: (ref: React.RefObject<{open: () => void; close: () => void}>) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const netInfo = useNetInfo();
  const [isOnline, setIsOnline] = useState(true);
  const [sheetRef, setSheetRef] = useState<React.RefObject<{open: () => void; close: () => void}> | null>(null);

  useEffect(() => {
    const isConnected = netInfo.isConnected ?? true;
    setIsOnline(isConnected);

    if (!isConnected && sheetRef?.current) {
      sheetRef.current.open();
    } else if (isConnected && sheetRef?.current) {
      sheetRef.current.close();
    }
  }, [netInfo.isConnected, sheetRef]);

  const value: NetworkContextType = {
    isOnline,
    sheetRef,
    setNetworkSheetRef: (ref) => setSheetRef(ref),
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetworkStatus = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetworkStatus must be used within NetworkProvider');
  }
  return context;
};
