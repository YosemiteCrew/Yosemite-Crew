import {renderHook, act} from '@testing-library/react-native';
import * as Redux from 'react-redux';
import {useBusinessPhotoFallback} from '@/features/appointments/hooks/useBusinessPhotoFallback';
import {
  fetchBusinessDetails,
  fetchGooglePlacesImage,
} from '@/features/linkedBusinesses';

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
}));

jest.mock('@/features/linkedBusinesses', () => ({
  fetchBusinessDetails: jest.fn(),
  fetchGooglePlacesImage: jest.fn(),
}));

describe('useBusinessPhotoFallback', () => {
  const mockDispatch = jest.fn(action => action);

  beforeEach(() => {
    jest.clearAllMocks();
    (Redux.useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);
  });

  it('starts with no business fallbacks', () => {
    const {result} = renderHook(() => useBusinessPhotoFallback());
    expect(result.current.businessFallbacks).toEqual({});
  });

  it('sets a fallback photo when fetchBusinessDetails resolves with a photoUrl', async () => {
    (fetchBusinessDetails as unknown as jest.Mock).mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({photoUrl: 'https://photo/1.jpg'}),
    });

    const {result} = renderHook(() => useBusinessPhotoFallback());

    await act(async () => {
      await result.current.requestBusinessPhoto('place-1', 'biz-1');
    });

    expect(fetchBusinessDetails).toHaveBeenCalledWith('place-1');
    expect(result.current.businessFallbacks).toEqual({
      'biz-1': {photo: 'https://photo/1.jpg'},
    });
    expect(fetchGooglePlacesImage).not.toHaveBeenCalled();
  });

  it('falls back to fetchGooglePlacesImage when details has no photoUrl', async () => {
    (fetchBusinessDetails as unknown as jest.Mock).mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({photoUrl: null}),
    });
    (fetchGooglePlacesImage as unknown as jest.Mock).mockReturnValue({
      unwrap: jest
        .fn()
        .mockResolvedValue({photoUrl: 'https://fallback/img.jpg'}),
    });

    const {result} = renderHook(() => useBusinessPhotoFallback());

    await act(async () => {
      await result.current.requestBusinessPhoto('place-2', 'biz-2');
    });

    expect(fetchGooglePlacesImage).toHaveBeenCalledWith('place-2');
    expect(result.current.businessFallbacks).toEqual({
      'biz-2': {photo: 'https://fallback/img.jpg'},
    });
  });

  it('falls back to fetchGooglePlacesImage when fetchBusinessDetails rejects', async () => {
    (fetchBusinessDetails as unknown as jest.Mock).mockReturnValue({
      unwrap: jest.fn().mockRejectedValue(new Error('details failed')),
    });
    (fetchGooglePlacesImage as unknown as jest.Mock).mockReturnValue({
      unwrap: jest
        .fn()
        .mockResolvedValue({photoUrl: 'https://fallback/img2.jpg'}),
    });

    const {result} = renderHook(() => useBusinessPhotoFallback());

    await act(async () => {
      await result.current.requestBusinessPhoto('place-3', 'biz-3');
    });

    expect(result.current.businessFallbacks).toEqual({
      'biz-3': {photo: 'https://fallback/img2.jpg'},
    });
  });

  it('swallows the error and leaves fallbacks untouched when fetchGooglePlacesImage also rejects', async () => {
    (fetchBusinessDetails as unknown as jest.Mock).mockReturnValue({
      unwrap: jest.fn().mockRejectedValue(new Error('details failed')),
    });
    (fetchGooglePlacesImage as unknown as jest.Mock).mockReturnValue({
      unwrap: jest.fn().mockRejectedValue(new Error('fallback failed')),
    });

    const {result} = renderHook(() => useBusinessPhotoFallback());

    await act(async () => {
      await result.current.requestBusinessPhoto('place-4', 'biz-4');
    });

    expect(result.current.businessFallbacks).toEqual({});
  });

  it('does not set a fallback when fetchGooglePlacesImage resolves without a photoUrl', async () => {
    (fetchBusinessDetails as unknown as jest.Mock).mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({photoUrl: null}),
    });
    (fetchGooglePlacesImage as unknown as jest.Mock).mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({photoUrl: null}),
    });

    const {result} = renderHook(() => useBusinessPhotoFallback());

    await act(async () => {
      await result.current.requestBusinessPhoto('place-5', 'biz-5');
    });

    expect(result.current.businessFallbacks).toEqual({});
  });

  it('does nothing when googlePlacesId is empty', async () => {
    const {result} = renderHook(() => useBusinessPhotoFallback());

    await act(async () => {
      await result.current.requestBusinessPhoto('', 'biz-6');
    });

    expect(fetchBusinessDetails).not.toHaveBeenCalled();
    expect(result.current.businessFallbacks).toEqual({});
  });

  it('does not re-request a photo for a googlePlacesId already requested', async () => {
    (fetchBusinessDetails as unknown as jest.Mock).mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({photoUrl: 'https://photo/dup.jpg'}),
    });

    const {result} = renderHook(() => useBusinessPhotoFallback());

    await act(async () => {
      await result.current.requestBusinessPhoto('place-dup', 'biz-dup');
    });
    await act(async () => {
      await result.current.requestBusinessPhoto('place-dup', 'biz-dup');
    });

    expect(fetchBusinessDetails).toHaveBeenCalledTimes(1);
  });

  it('setBusinessFallbacks allows manually updating state', () => {
    const {result} = renderHook(() => useBusinessPhotoFallback());

    act(() => {
      result.current.setBusinessFallbacks({manual: {photo: 'manual.jpg'}});
    });

    expect(result.current.businessFallbacks).toEqual({
      manual: {photo: 'manual.jpg'},
    });
  });

  describe('handleAvatarError', () => {
    it('does nothing when googlePlacesId is null', () => {
      const {result} = renderHook(() => useBusinessPhotoFallback());

      act(() => {
        result.current.handleAvatarError(null, 'biz-7');
      });

      expect(fetchBusinessDetails).not.toHaveBeenCalled();
    });

    it('requests a business photo when googlePlacesId is provided', async () => {
      (fetchBusinessDetails as unknown as jest.Mock).mockReturnValue({
        unwrap: jest.fn().mockResolvedValue({photoUrl: 'https://photo/8.jpg'}),
      });

      const {result} = renderHook(() => useBusinessPhotoFallback());

      await act(async () => {
        result.current.handleAvatarError('place-8', 'biz-8');
      });

      expect(fetchBusinessDetails).toHaveBeenCalledWith('place-8');
    });
  });
});
