import React, {createContext, useContext, useState, useCallback, useMemo} from 'react';

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
    </GlobalLoaderContext.Provider>
  );
};

export const useGlobalLoader = () => {
  const context = useContext(GlobalLoaderContext);
  if (context === undefined) {
    throw new Error(
      'useGlobalLoader must be used within a GlobalLoaderProvider',
    );
  }
  return context;
};
