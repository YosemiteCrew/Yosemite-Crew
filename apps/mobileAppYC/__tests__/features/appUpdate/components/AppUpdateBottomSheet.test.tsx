import React from 'react';
import {Alert, Linking} from 'react-native';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react-native';
import {mockTheme} from '../../../setup/mockTheme';
import AppUpdateBottomSheet from '@/features/appUpdate/components/AppUpdateBottomSheet';
import type {AppUpdatePrompt} from '@/features/appUpdate/services/appUpdatePolicy';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Capture the props handed to the underlying sheet and expose the imperative
// handle (snapToIndex/close) the component calls through its own ref methods.
const mockSnapToIndex = jest.fn();
const mockClose = jest.fn();
let lastBottomSheetProps: any = null;

jest.mock('@/shared/components/common/BottomSheet/BottomSheet', () => {
  const ReactMock = require('react');
  const {View} = require('react-native');
  const Mock = ReactMock.forwardRef((props: any, ref: any) => {
    lastBottomSheetProps = props;
    ReactMock.useImperativeHandle(ref, () => ({
      snapToIndex: mockSnapToIndex,
      close: mockClose,
    }));
    return <View testID="bottom-sheet">{props.children}</View>;
  });
  Mock.displayName = 'CustomBottomSheet';
  return {__esModule: true, default: Mock};
});

const optionalPrompt: AppUpdatePrompt = {
  kind: 'optional',
  storeUrl: 'https://play.google.com/store/apps/details?id=com.mobileappyc',
  remindAfterHours: 1,
  currentVersion: '1.0.0',
  currentBuildNumber: 1,
};

const requiredPrompt: AppUpdatePrompt = {
  kind: 'required',
  storeUrl: 'https://play.google.com/store/apps/details?id=com.mobileappyc',
  remindAfterHours: 1,
  currentVersion: '1.0.0',
  currentBuildNumber: 1,
};

describe('AppUpdateBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastBottomSheetProps = null;
  });

  describe('rendering', () => {
    it('renders the header logo, fallback optional title and single-line changelog', () => {
      render(<AppUpdateBottomSheet prompt={optionalPrompt} />);

      expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
      expect(screen.getByText('appUpdate.optionalTitle')).toBeTruthy();
      // message falls back to optional key → one changelog row + one icon
      expect(screen.getByText('appUpdate.optionalMessage')).toBeTruthy();
      expect(screen.getByTestId('icon-sparkles-outline')).toBeTruthy();
      // primary button label (t returns the key)
      expect(screen.getByText('appUpdate.updateNowButton')).toBeTruthy();
    });

    it('uses required translation keys when kind is required', () => {
      render(<AppUpdateBottomSheet prompt={requiredPrompt} />);

      expect(screen.getByText('appUpdate.requiredTitle')).toBeTruthy();
      expect(screen.getByText('appUpdate.requiredMessage')).toBeTruthy();
    });

    it('uses custom title/message from the prompt when provided', () => {
      render(
        <AppUpdateBottomSheet
          prompt={{
            ...optionalPrompt,
            title: 'Custom title',
            message: 'Custom message',
          }}
        />,
      );

      expect(screen.getByText('Custom title')).toBeTruthy();
      expect(screen.getByText('Custom message')).toBeTruthy();
    });

    it('renders the version line as current only when no latestVersion', () => {
      render(<AppUpdateBottomSheet prompt={optionalPrompt} />);
      expect(screen.getByText('1.0.0')).toBeTruthy();
    });

    it('renders the version line as current → latest when latestVersion is set', () => {
      render(
        <AppUpdateBottomSheet
          prompt={{...optionalPrompt, latestVersion: '1.2.0'}}
        />,
      );
      expect(screen.getByText('1.0.0 → 1.2.0')).toBeTruthy();
    });
  });

  describe('changelog list', () => {
    it('splits a multi-line message into rows, trims and drops blank lines, and cycles category icons', () => {
      render(
        <AppUpdateBottomSheet
          prompt={{
            ...optionalPrompt,
            message: 'New features\n\n  Bug fixes  \nPerformance boosts',
          }}
        />,
      );

      // blank middle line is filtered out → 3 rows
      expect(screen.getByText('New features')).toBeTruthy();
      expect(screen.getByText('Bug fixes')).toBeTruthy();
      expect(screen.getByText('Performance boosts')).toBeTruthy();
      expect(screen.getByTestId('icon-sparkles-outline')).toBeTruthy();
      expect(screen.getByTestId('icon-flash-outline')).toBeTruthy();
      expect(screen.getByTestId('icon-bug-outline')).toBeTruthy();
    });

    it('cycles the icon set back to the start for a fourth line', () => {
      render(
        <AppUpdateBottomSheet
          prompt={{...optionalPrompt, message: 'A\nB\nC\nD'}}
        />,
      );

      // index 0 and 3 both resolve to sparkles-outline (modulo wrap)
      expect(screen.getAllByTestId('icon-sparkles-outline')).toHaveLength(2);
      expect(screen.getByTestId('icon-flash-outline')).toBeTruthy();
      expect(screen.getByTestId('icon-bug-outline')).toBeTruthy();
    });

    it('renders no changelog block when the message is whitespace only', () => {
      render(
        <AppUpdateBottomSheet prompt={{...optionalPrompt, message: '   '}} />,
      );

      // whitespace message is truthy (skips fallback) but filters to zero rows
      expect(screen.queryByTestId('icon-sparkles-outline')).toBeNull();
      // primary button still renders
      expect(screen.getByText('appUpdate.updateNowButton')).toBeTruthy();
    });
  });

  describe('sheet configuration', () => {
    it('defaults initialIndex to -1 (closed) and applies optional behavior', () => {
      render(<AppUpdateBottomSheet prompt={optionalPrompt} />);

      expect(lastBottomSheetProps.initialIndex).toBe(-1);
      expect(lastBottomSheetProps.snapPoints).toEqual(['90%']);
      expect(lastBottomSheetProps.zIndex).toBe(100);
      expect(lastBottomSheetProps.contentType).toBe('view');
      expect(lastBottomSheetProps.backdropPressBehavior).toBe('close');
      expect(lastBottomSheetProps.behavior.panDownToClose).toBe(true);
      expect(lastBottomSheetProps.behavior.handlePanningGesture).toBe(true);
    });

    it('locks the sheet down for a required prompt', () => {
      render(<AppUpdateBottomSheet prompt={requiredPrompt} />);

      expect(lastBottomSheetProps.backdropPressBehavior).toBe('none');
      expect(lastBottomSheetProps.behavior.panDownToClose).toBe(false);
      expect(lastBottomSheetProps.behavior.handlePanningGesture).toBe(false);
    });

    it('opens on mount when initialOpen is true', () => {
      render(<AppUpdateBottomSheet prompt={optionalPrompt} initialOpen />);
      expect(lastBottomSheetProps.initialIndex).toBe(0);
    });
  });

  describe('later / dismiss link (optional only)', () => {
    it('renders the later link for an optional prompt and hides it for required', () => {
      const {rerender} = render(
        <AppUpdateBottomSheet prompt={optionalPrompt} />,
      );
      expect(screen.getByLabelText('appUpdate.laterButton')).toBeTruthy();

      rerender(<AppUpdateBottomSheet prompt={requiredPrompt} />);
      expect(screen.queryByLabelText('appUpdate.laterButton')).toBeNull();
    });

    it('calls onDeferred and closes the sheet when later is pressed', () => {
      const onDeferred = jest.fn();
      render(
        <AppUpdateBottomSheet
          prompt={optionalPrompt}
          onDeferred={onDeferred}
        />,
      );

      fireEvent.press(screen.getByLabelText('appUpdate.laterButton'));

      expect(onDeferred).toHaveBeenCalledTimes(1);
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('does not throw when later is pressed without an onDeferred handler', () => {
      render(<AppUpdateBottomSheet prompt={optionalPrompt} />);

      expect(() =>
        fireEvent.press(screen.getByLabelText('appUpdate.laterButton')),
      ).not.toThrow();
      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('primary button (open store)', () => {
    it('opens the store URL when present', async () => {
      const openURL = jest
        .spyOn(Linking, 'openURL')
        .mockResolvedValue(undefined as any);

      render(<AppUpdateBottomSheet prompt={optionalPrompt} />);
      fireEvent.press(screen.getByLabelText('appUpdate.updateNowButton'));

      await waitFor(() =>
        expect(openURL).toHaveBeenCalledWith(optionalPrompt.storeUrl),
      );
      openURL.mockRestore();
    });

    it('alerts when the store URL is missing', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

      render(
        <AppUpdateBottomSheet prompt={{...optionalPrompt, storeUrl: null}} />,
      );
      await act(async () => {
        fireEvent.press(screen.getByLabelText('appUpdate.updateNowButton'));
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'common.error',
        'appUpdate.missingStoreUrl',
      );
      alertSpy.mockRestore();
    });

    it('alerts when Linking.openURL rejects', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const openURL = jest
        .spyOn(Linking, 'openURL')
        .mockRejectedValue(new Error('Cannot open'));

      render(<AppUpdateBottomSheet prompt={optionalPrompt} />);
      fireEvent.press(screen.getByLabelText('appUpdate.updateNowButton'));

      await waitFor(() =>
        expect(alertSpy).toHaveBeenCalledWith(
          'common.error',
          'appUpdate.openStoreFailed',
        ),
      );
      expect(warnSpy).toHaveBeenCalled();

      alertSpy.mockRestore();
      warnSpy.mockRestore();
      openURL.mockRestore();
    });

    it('refuses to open an untrusted store URL and never calls Linking.openURL', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const openURL = jest
        .spyOn(Linking, 'openURL')
        .mockResolvedValue(undefined as any);

      render(
        <AppUpdateBottomSheet
          prompt={{...optionalPrompt, storeUrl: 'https://evil.example.com/x'}}
        />,
      );
      await act(async () => {
        fireEvent.press(screen.getByLabelText('appUpdate.updateNowButton'));
      });

      expect(openURL).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith(
        'common.error',
        'appUpdate.openStoreFailed',
      );
      expect(warnSpy).toHaveBeenCalled();

      alertSpy.mockRestore();
      warnSpy.mockRestore();
      openURL.mockRestore();
    });

    it('disables the primary button for a required prompt with no store URL', () => {
      const openURL = jest
        .spyOn(Linking, 'openURL')
        .mockResolvedValue(undefined as any);

      render(
        <AppUpdateBottomSheet prompt={{...requiredPrompt, storeUrl: null}} />,
      );

      const button = screen.getByLabelText('appUpdate.updateNowButton');
      expect(button.props.accessibilityState.disabled).toBe(true);

      fireEvent.press(button);
      expect(openURL).not.toHaveBeenCalled();
      openURL.mockRestore();
    });
  });

  describe('imperative ref (open/close)', () => {
    it('routes open() to snapToIndex(0) and close() to close()', () => {
      const ref = React.createRef<any>();
      render(<AppUpdateBottomSheet ref={ref} prompt={optionalPrompt} />);

      act(() => ref.current.open());
      expect(mockSnapToIndex).toHaveBeenCalledWith(0);

      act(() => ref.current.close());
      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('onChange lifecycle → deferral', () => {
    it('does not call onDeferred when the sheet closes without ever opening', () => {
      const onDeferred = jest.fn();
      render(
        <AppUpdateBottomSheet
          prompt={optionalPrompt}
          onDeferred={onDeferred}
        />,
      );

      act(() => lastBottomSheetProps.onChange(-1));
      expect(onDeferred).not.toHaveBeenCalled();
    });

    it('calls onDeferred once when an optional sheet closes after opening', () => {
      const onDeferred = jest.fn();
      render(
        <AppUpdateBottomSheet
          prompt={optionalPrompt}
          onDeferred={onDeferred}
        />,
      );

      act(() => lastBottomSheetProps.onChange(0));
      act(() => lastBottomSheetProps.onChange(-1));

      expect(onDeferred).toHaveBeenCalledTimes(1);
    });

    it('does not call onDeferred a second time on a repeated close', () => {
      const onDeferred = jest.fn();
      render(
        <AppUpdateBottomSheet
          prompt={optionalPrompt}
          onDeferred={onDeferred}
        />,
      );

      act(() => lastBottomSheetProps.onChange(0));
      act(() => lastBottomSheetProps.onChange(-1));
      // refs were reset on the first close, so the second close is a no-op
      act(() => lastBottomSheetProps.onChange(-1));

      expect(onDeferred).toHaveBeenCalledTimes(1);
    });

    it('does not call onDeferred for a required prompt on close', () => {
      const onDeferred = jest.fn();
      render(
        <AppUpdateBottomSheet
          prompt={requiredPrompt}
          onDeferred={onDeferred}
        />,
      );

      act(() => lastBottomSheetProps.onChange(0));
      act(() => lastBottomSheetProps.onChange(-1));

      expect(onDeferred).not.toHaveBeenCalled();
    });

    it('does not double-fire onDeferred when later was pressed before close', () => {
      const onDeferred = jest.fn();
      render(
        <AppUpdateBottomSheet
          prompt={optionalPrompt}
          onDeferred={onDeferred}
        />,
      );

      act(() => lastBottomSheetProps.onChange(0));
      fireEvent.press(screen.getByLabelText('appUpdate.laterButton'));
      act(() => lastBottomSheetProps.onChange(-1));

      // once from the later button, not again from onChange (deferredHandledRef)
      expect(onDeferred).toHaveBeenCalledTimes(1);
    });

    it('does not throw when the optional sheet closes without an onDeferred handler', () => {
      render(<AppUpdateBottomSheet prompt={optionalPrompt} />);

      expect(() => {
        act(() => lastBottomSheetProps.onChange(0));
        act(() => lastBottomSheetProps.onChange(-1));
      }).not.toThrow();
    });
  });
});
