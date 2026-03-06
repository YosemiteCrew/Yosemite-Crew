import React, {createContext, useContext, useState, useCallback, useMemo} from 'react';
import {StyleSheet, View, Modal} from 'react-native';
import {useTheme} from '@/hooks';
import {GifLoader} from '@/shared/components/common/GifLoader/GifLoader';

interface GlobalLoaderContextType {
  showLoader: () => void;
  hideLoader: () => void;
  isLoading: boolean;
}

const GlobalLoaderContext = createContext<GlobalLoaderContextType | undefined>(
  undefined,
);

export const GlobalLoaderProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const showLoader = useCallback(() => {
    setIsLoading(true);
  }, []);

  const hideLoader = useCallback(() => {
    setIsLoading(false);
  }, []);

  const value = useMemo(
    () => ({showLoader, hideLoader, isLoading}),
    [showLoader, hideLoader, isLoading],
  );

  return (
    <GlobalLoaderContext.Provider value={value}>
      {children}
      {isLoading && (
        <Modal
          transparent
          visible={isLoading}
          animationType="fade"
          statusBarTranslucent>
          <View style={styles.loaderOverlay}>
            <GifLoader size="large" />
          </View>
        </Modal>
      )}
    </GlobalLoaderContext.Provider>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    loaderOverlay: {
      flex: 1,
      backgroundColor: theme.colors.white,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export const useGlobalLoader = () => {
  const context = useContext(GlobalLoaderContext);
  if (context === undefined) {
    throw new Error(
      'useGlobalLoader must be used within a GlobalLoaderProvider',
    );
  }
  return context;
};
