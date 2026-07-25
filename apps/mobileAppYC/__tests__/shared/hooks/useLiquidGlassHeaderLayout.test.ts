import {renderHook, act} from '@testing-library/react-native';
import {mockTheme} from '../../setup/mockTheme';
import {useLiquidGlassHeaderLayout} from '@/shared/hooks/useLiquidGlassHeaderLayout';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 44, bottom: 0, left: 0, right: 0}),
}));

const mockCreateLiquidGlassHeaderStyles = jest.fn(() => ({
  topSection: {position: 'absolute'},
  topGlassShadowWrapper: {borderRadius: 10},
  topGlassCard: {padding: 5},
  topGlassFallback: {padding: 3},
}));
jest.mock('@/shared/utils/screenStyles', () => ({
  createLiquidGlassHeaderStyles: (...args: any[]) =>
    mockCreateLiquidGlassHeaderStyles(...args),
}));

describe('useLiquidGlassHeaderLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns headerProps derived from theme, insets, and initial zero height', () => {
    const {result} = renderHook(() => useLiquidGlassHeaderLayout());

    expect(result.current.headerProps.insetsTop).toBe(44);
    expect(result.current.headerProps.currentHeight).toBe(0);
    expect(result.current.headerProps.topSectionStyle).toEqual({
      position: 'absolute',
    });
    expect(result.current.headerProps.shadowWrapperStyle).toEqual({
      borderRadius: 10,
    });
    expect(result.current.headerProps.cardStyle).toEqual({padding: 5});
    expect(result.current.headerProps.fallbackStyle).toEqual({padding: 3});
  });

  it('returns null contentPaddingStyle when the header has not been measured yet', () => {
    const {result} = renderHook(() => useLiquidGlassHeaderLayout());
    expect(result.current.contentPaddingStyle).toBeNull();
  });

  it('computes contentPaddingStyle using the default theme spacing once height is set', () => {
    const {result} = renderHook(() => useLiquidGlassHeaderLayout());

    act(() => {
      result.current.headerProps.onHeightChange(100);
    });

    expect(result.current.headerProps.currentHeight).toBe(100);
    expect(result.current.contentPaddingStyle).toEqual({
      paddingTop: 100 + mockTheme.spacing['3'],
    });
  });

  it('uses a custom contentPadding value when provided', () => {
    const {result} = renderHook(() =>
      useLiquidGlassHeaderLayout({contentPadding: 20}),
    );

    act(() => {
      result.current.headerProps.onHeightChange(100);
    });

    expect(result.current.contentPaddingStyle).toEqual({paddingTop: 120});
  });

  it('passes cardGap through to createLiquidGlassHeaderStyles', () => {
    renderHook(() => useLiquidGlassHeaderLayout({cardGap: 12}));

    expect(mockCreateLiquidGlassHeaderStyles).toHaveBeenCalledWith(mockTheme, {
      cardGap: 12,
    });
  });
});
