import React, { createContext, useContext, useRef, useCallback, useMemo } from 'react';
import { EmergencyBottomSheetRef } from '@/features/home/components/EmergencyBottomSheet';

interface EmergencyContextType {
  emergencySheetRef: React.RefObject<EmergencyBottomSheetRef | null>;
  openEmergencySheet: () => void;
  closeEmergencySheet: () => void;
  setEmergencySheetRef: (ref: React.RefObject<EmergencyBottomSheetRef>) => void;
}

const EmergencyContext = createContext<EmergencyContextType | undefined>(undefined);

export const EmergencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const emergencySheetRef = useRef<EmergencyBottomSheetRef>(null);

  const openEmergencySheet = useCallback(() => {
    if (emergencySheetRef.current) {
      emergencySheetRef.current.open();
    }
  }, []);

  const closeEmergencySheet = useCallback(() => {
    if (emergencySheetRef.current) {
      emergencySheetRef.current.close();
    }
  }, []);

  const setEmergencySheetRef = useCallback((ref: React.RefObject<EmergencyBottomSheetRef>) => {
    emergencySheetRef.current = ref.current;
  }, []);

  const value: EmergencyContextType = useMemo(() => ({
    emergencySheetRef,
    openEmergencySheet,
    closeEmergencySheet,
    setEmergencySheetRef,
  }), [openEmergencySheet, closeEmergencySheet, setEmergencySheetRef]);

  return (
    <EmergencyContext.Provider value={value}>
      {children}
    </EmergencyContext.Provider>
  );
};

export const useEmergency = () => {
  const context = useContext(EmergencyContext);
  if (!context) {
    throw new Error('useEmergency must be used within EmergencyProvider');
  }
  return context;
};
