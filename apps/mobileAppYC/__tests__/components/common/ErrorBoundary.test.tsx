import React from 'react';
import {render, fireEvent, screen} from '@testing-library/react-native';
import {ErrorBoundary} from '@/shared/components/common/ErrorBoundary/ErrorBoundary';
import {View, Text, TouchableOpacity} from 'react-native';

// --- Mocks ---

// Mock console.error to prevent Jest from failing tests when errors are logged
const consoleErrorSpy = jest
  .spyOn(console, 'error')
  .mockImplementation(() => {});

// --- Helper Components ---

const TEST_ERROR_MESSAGE = 'This is a test error';

// A component that always throws an error
const ProblemComponent = () => {
  throw new Error(TEST_ERROR_MESSAGE);
};

// A component that renders normally
const HealthyComponent = () => <Text>Success</Text>;

// A custom fallback component
const CustomFallback = ({
  error,
  resetError,
}: {
  error: Error;
  resetError: () => void;
}) => (
  <View>
    <Text>Custom Fallback</Text>
    <Text>{error.message}</Text>
    <TouchableOpacity onPress={resetError}>
      <Text>Custom Reset</Text>
    </TouchableOpacity>
  </View>
);

// --- Tests ---

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Clear mocks before each test
    consoleErrorSpy.mockClear();
    // Reset __DEV__ global before each test
    (globalThis as any).__DEV__ = true;
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <HealthyComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Success')).toBeTruthy();
    expect(screen.queryByText('Oops! Something went wrong')).toBeNull();
  });

  it('catches an error and displays the default fallback UI', () => {
    render(
      <ErrorBoundary>
        <ProblemComponent />
      </ErrorBoundary>,
    );

    // Should show default fallback
    expect(screen.getByText('Oops! Something went wrong')).toBeTruthy();
    expect(screen.getByText('Try Again')).toBeTruthy();

    // Should not show children
    expect(screen.queryByText('Success')).toBeNull();

    // Should log the error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'ErrorBoundary caught an error:',
      expect.any(Error),
    );
  });

  it('displays a custom fallback component when provided', () => {
    render(
      <ErrorBoundary fallback={CustomFallback}>
        <ProblemComponent />
      </ErrorBoundary>,
    );

    // Should show custom fallback
    expect(screen.getByText('Custom Fallback')).toBeTruthy();
    expect(screen.getByText(TEST_ERROR_MESSAGE)).toBeTruthy();
    expect(screen.getByText('Custom Reset')).toBeTruthy();

    // Should not show default fallback
    expect(screen.queryByText('Oops! Something went wrong')).toBeNull();
  });

  it('resets the error when "Try Again" is pressed', () => {
    const {getByText} = render(
      <ErrorBoundary>
        <ProblemComponent />
      </ErrorBoundary>,
    );

    // 1. We are in the error state
    expect(getByText('Oops! Something went wrong')).toBeTruthy();
    // FIX: Expect 4 calls: 1 from React Test Renderer, 3 from componentDidCatch
    expect(consoleErrorSpy).toHaveBeenCalledTimes(4);

    consoleErrorSpy.mockClear();

    // 2. Press "Try Again"
    fireEvent.press(getByText('Try Again'));

    // 3. It will try to re-render ProblemComponent, which will error again
    // We can confirm the reset-and-recatch cycle happened
    // because console.error was called again.
    // FIX: Expect 4 calls again for the re-render error
    expect(consoleErrorSpy).toHaveBeenCalledTimes(4);
    expect(getByText('Oops! Something went wrong')).toBeTruthy();
  });

  it('calls resetError from the custom fallback', () => {
    const {getByText} = render(
      <ErrorBoundary fallback={CustomFallback}>
        <ProblemComponent />
      </ErrorBoundary>,
    );

    // 1. We are in the error state
    expect(getByText('Custom Fallback')).toBeTruthy();
    // FIX: Expect 4 calls: 1 from React Test Renderer, 3 from componentDidCatch
    expect(consoleErrorSpy).toHaveBeenCalledTimes(4);

    consoleErrorSpy.mockClear();

    // 2. Press "Custom Reset"
    fireEvent.press(getByText('Custom Reset'));

    // 3. It re-catches the error, proving the reset worked
    // FIX: Expect 4 calls again for the re-render error
    expect(consoleErrorSpy).toHaveBeenCalledTimes(4);
    expect(getByText('Custom Fallback')).toBeTruthy();
  });

  it('shows error details when __DEV__ is true', () => {
    (globalThis as any).__DEV__ = true;
    render(
      <ErrorBoundary>
        <ProblemComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Error Details (Dev Only):')).toBeTruthy();
    expect(screen.getByText(`Error: ${TEST_ERROR_MESSAGE}`)).toBeTruthy();
  });

  it('hides error details when __DEV__ is false', () => {
    (globalThis as any).__DEV__ = false;
    render(
      <ErrorBoundary>
        <ProblemComponent />
      </ErrorBoundary>,
    );

    expect(screen.queryByText('Error Details (Dev Only):')).toBeNull();
    expect(screen.queryByText(`Error: ${TEST_ERROR_MESSAGE}`)).toBeNull();

    // Still shows the generic message
    expect(screen.getByText('Oops! Something went wrong')).toBeTruthy();
  });
});
