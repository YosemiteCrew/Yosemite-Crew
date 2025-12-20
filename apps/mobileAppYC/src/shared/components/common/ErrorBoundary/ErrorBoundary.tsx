import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ScrollView} from 'react-native';
import {useTheme} from '@/hooks';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{error: Error; resetError: () => void}>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// Functional component for the error fallback UI
const ErrorFallback: React.FC<{
  error: Error;
  errorInfo: React.ErrorInfo | null;
  resetError: () => void;
}> = ({error, errorInfo, resetError}) => {
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Oops! Something went wrong</Text>
        <Text style={styles.message}>
          The app encountered an unexpected error. Don't worry, your data is safe.
        </Text>

        {__DEV__ && (
          <View style={styles.errorDetails}>
            <Text style={styles.errorTitle}>Error Details (Dev Only):</Text>
            <Text style={styles.errorText}>{error.toString()}</Text>
            {errorInfo?.componentStack && (
              <Text style={styles.stackText}>{errorInfo.componentStack}</Text>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.button} onPress={resetError}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);
    console.error('Component stack:', errorInfo.componentStack);

    // Log to your error reporting service here (e.g., Sentry, Crashlytics)
    this.setState({
      errorInfo,
    });
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      // Default error UI
      return (
        <ErrorFallback error={this.state.error} errorInfo={this.state.errorInfo} resetError={this.resetError} />
      );
    }

    return this.props.children;
  }
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.white,
    },
    scrollContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing['5'],
    },
    title: {
      ...theme.typography.h2,
      color: theme.colors.text,
      marginBottom: theme.spacing['4'],
      textAlign: 'center',
    },
    message: {
      ...theme.typography.paragraph,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing['8'],
      lineHeight: theme.spacing['6'],
    },
    errorDetails: {
      width: '100%',
      backgroundColor: theme.colors.backgroundSecondary,
      padding: theme.spacing['4'],
      borderRadius: theme.borderRadius.base,
      marginBottom: theme.spacing['6'],
    },
    errorTitle: {
      ...theme.typography.labelSmBold,
      color: theme.colors.error,
      marginBottom: theme.spacing['2'],
    },
    errorText: {
      ...theme.typography.labelXs,
      color: theme.colors.error,
      fontFamily: 'monospace',
      marginBottom: theme.spacing['2'],
    },
    stackText: {
      fontSize: theme.spacing['2.5'],
      color: theme.colors.textSecondary,
      fontFamily: 'monospace',
    },
    button: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing['8'],
      paddingVertical: theme.spacing['3'],
      borderRadius: theme.borderRadius.base,
      ...theme.shadows.sm,
    },
    buttonText: {
      color: theme.colors.white,
      ...theme.typography.paragraph,
      fontWeight: '600',
    },
  });
