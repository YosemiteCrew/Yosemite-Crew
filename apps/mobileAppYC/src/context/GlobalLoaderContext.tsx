import React, {createContext, use, useState, useCallback, useMemo} from 'react';
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
  const [isLoaderVisible, setIsLoaderVisible] = useState(false);
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const showLoader = useCallback(() => {
    setIsLoaderVisible(true);
  }, []);

  const hideLoader = useCallback(() => {
    setIsLoaderVisible(false);
  }, []);

  const value = useMemo(
    () => ({showLoader, hideLoader, isLoading: isLoaderVisible}),
    [showLoader, hideLoader, isLoaderVisible],
  );

  return (
    <GlobalLoaderContext.Provider value={value}>
      {children}
      {isLoaderVisible && (
        <Modal
          transparent
          visible={isLoaderVisible}
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
  const context = use(GlobalLoaderContext);
  if (context === undefined) {
    throw new Error(
      'useGlobalLoader must be used within a GlobalLoaderProvider',
    );
  }
  return context;
};
