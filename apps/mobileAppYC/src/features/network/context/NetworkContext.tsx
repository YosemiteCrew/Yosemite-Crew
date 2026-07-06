import React, {createContext, use, useEffect, useMemo, useState} from 'react';
import {useNetInfo} from '@react-native-community/netinfo';

export interface NetworkContextType {
  isOnline: boolean;
  sheetRef: React.RefObject<{open: () => void; close: () => void}> | null;
  setNetworkSheetRef: (
    ref: React.RefObject<{open: () => void; close: () => void}>,
  ) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected ?? true;
  const [sheetRef, setSheetRef] = useState<React.RefObject<{
    open: () => void;
    close: () => void;
  }> | null>(null);

  useEffect(() => {
    if (!isOnline && sheetRef?.current) {
      sheetRef.current.open();
    } else if (isOnline && sheetRef?.current) {
      sheetRef.current.close();
    }
  }, [isOnline, sheetRef]);

  const value = useMemo<NetworkContextType>(
    () => ({
      isOnline,
      sheetRef,
      setNetworkSheetRef: ref => setSheetRef(ref),
    }),
    [isOnline, sheetRef],
  );

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
};

export const useNetworkStatus = () => {
  const context = use(NetworkContext);
  if (!context) {
    throw new Error('useNetworkStatus must be used within NetworkProvider');
  }
  return context;
};
