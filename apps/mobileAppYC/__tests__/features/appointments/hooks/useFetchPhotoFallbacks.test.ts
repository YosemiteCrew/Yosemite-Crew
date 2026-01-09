import {renderHook} from '@testing-library/react-hooks';
import {useFetchPhotoFallbacks} from '@/features/appointments/hooks/useFetchPhotoFallbacks';
import {isDummyPhoto} from '@/features/appointments/utils/photoUtils';

jest.mock('@/features/appointments/utils/photoUtils', () => ({
  isDummyPhoto: jest.fn(),
}));

describe('useFetchPhotoFallbacks', () => {
  const mockRequestBusinessPhoto = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (isDummyPhoto as jest.Mock).mockReturnValue(false);
  });

  it('should not request photos when appointments have valid photos', () => {
    const appointments = [
      {
        id: 'apt-1',
        businessId: 'b1',
        businessPhoto: 'https://example.com/photo.jpg',
      },
    ];

    const businessMap = new Map([
      ['b1', {id: 'b1', photo: 'https://example.com/photo.jpg', googlePlacesId: 'place-1'}],
    ]);

    renderHook(() => useFetchPhotoFallbacks(appointments, businessMap, mockRequestBusinessPhoto));

    expect(mockRequestBusinessPhoto).not.toHaveBeenCalled();
  });

  it('should request photos when appointment photo is missing and has googlePlacesId', () => {
    (isDummyPhoto as jest.Mock).mockReturnValue(false);

    const appointments = [
      {
        id: 'apt-1',
        businessId: 'b1',
        businessPhoto: null,
        businessGooglePlacesId: 'place-1',
      },
    ];

    const businessMap = new Map([
      ['b1', {id: 'b1', photo: null, googlePlacesId: 'place-1'}],
    ]);

    renderHook(() => useFetchPhotoFallbacks(appointments, businessMap, mockRequestBusinessPhoto));

    expect(mockRequestBusinessPhoto).toHaveBeenCalledWith('place-1', 'b1');
  });

  it('should request photos when photo is a dummy photo', () => {
    (isDummyPhoto as jest.Mock).mockReturnValue(true);

    const appointments = [
      {
        id: 'apt-1',
        businessId: 'b1',
        businessPhoto: 'dummy.png',
      },
    ];

    const businessMap = new Map([
      ['b1', {id: 'b1', photo: 'dummy.png', googlePlacesId: 'place-1'}],
    ]);

    renderHook(() => useFetchPhotoFallbacks(appointments, businessMap, mockRequestBusinessPhoto));

    expect(mockRequestBusinessPhoto).toHaveBeenCalledWith('place-1', 'b1');
  });

  it('should use business googlePlacesId from businessMap', () => {
    (isDummyPhoto as jest.Mock).mockReturnValue(true);

    const appointments = [
      {
        id: 'apt-1',
        businessId: 'b1',
        businessPhoto: 'dummy.png',
      },
    ];

    const businessMap = new Map([
      ['b1', {id: 'b1', photo: null, googlePlacesId: 'place-from-map'}],
    ]);

    renderHook(() => useFetchPhotoFallbacks(appointments, businessMap, mockRequestBusinessPhoto));

    expect(mockRequestBusinessPhoto).toHaveBeenCalledWith('place-from-map', 'b1');
  });

  it('should use businessGooglePlacesId from appointment when business not in map', () => {
    (isDummyPhoto as jest.Mock).mockReturnValue(true);

    const appointments = [
      {
        id: 'apt-1',
        businessId: 'b1',
        businessPhoto: 'dummy.png',
        businessGooglePlacesId: 'place-from-apt',
      },
    ];

    const businessMap = new Map();

    renderHook(() => useFetchPhotoFallbacks(appointments, businessMap, mockRequestBusinessPhoto));

    expect(mockRequestBusinessPhoto).toHaveBeenCalledWith('place-from-apt', 'b1');
  });

  it('should not request photo when googlePlacesId is missing', () => {
    (isDummyPhoto as jest.Mock).mockReturnValue(true);

    const appointments = [
      {
        id: 'apt-1',
        businessId: 'b1',
        businessPhoto: 'dummy.png',
      },
    ];

    const businessMap = new Map([
      ['b1', {id: 'b1', photo: null, googlePlacesId: null}],
    ]);

    renderHook(() => useFetchPhotoFallbacks(appointments, businessMap, mockRequestBusinessPhoto));

    expect(mockRequestBusinessPhoto).not.toHaveBeenCalled();
  });

  it('should handle multiple appointments', () => {
    (isDummyPhoto as jest.Mock).mockReturnValue(true);

    const appointments = [
      {
        id: 'apt-1',
        businessId: 'b1',
        businessPhoto: null,
        businessGooglePlacesId: 'place-1',
      },
      {
        id: 'apt-2',
        businessId: 'b2',
        businessPhoto: null,
        businessGooglePlacesId: 'place-2',
      },
    ];

    const businessMap = new Map([
      ['b1', {id: 'b1', photo: null, googlePlacesId: 'place-1'}],
      ['b2', {id: 'b2', photo: null, googlePlacesId: 'place-2'}],
    ]);

    renderHook(() => useFetchPhotoFallbacks(appointments, businessMap, mockRequestBusinessPhoto));

    expect(mockRequestBusinessPhoto).toHaveBeenCalledTimes(2);
    expect(mockRequestBusinessPhoto).toHaveBeenCalledWith('place-1', 'b1');
    expect(mockRequestBusinessPhoto).toHaveBeenCalledWith('place-2', 'b2');
  });

  it('should prefer business photo over appointment photo', () => {
    (isDummyPhoto as jest.Mock).mockReturnValue(false);

    const appointments = [
      {
        id: 'apt-1',
        businessId: 'b1',
        businessPhoto: 'apt-photo.jpg',
      },
    ];

    const businessMap = new Map([
      ['b1', {id: 'b1', photo: 'biz-photo.jpg', googlePlacesId: 'place-1'}],
    ]);

    renderHook(() => useFetchPhotoFallbacks(appointments, businessMap, mockRequestBusinessPhoto));

    expect(mockRequestBusinessPhoto).not.toHaveBeenCalled();
  });

  it('should re-run effect when appointments change', () => {
    (isDummyPhoto as jest.Mock).mockReturnValue(true);

    const appointments1 = [
      {
        id: 'apt-1',
        businessId: 'b1',
        businessPhoto: null,
        businessGooglePlacesId: 'place-1',
      },
    ];

    const businessMap = new Map([
      ['b1', {id: 'b1', photo: null, googlePlacesId: 'place-1'}],
    ]);

    const {rerender} = renderHook(
      ({appointments}) => useFetchPhotoFallbacks(appointments, businessMap, mockRequestBusinessPhoto),
      {initialProps: {appointments: appointments1}},
    );

    const initialCalls = mockRequestBusinessPhoto.mock.calls.length;

    const appointments2 = [
      ...appointments1,
      {
        id: 'apt-2',
        businessId: 'b2',
        businessPhoto: null,
        businessGooglePlacesId: 'place-2',
      },
    ];

    const updatedBusinessMap = new Map([
      ...businessMap,
      ['b2', {id: 'b2', photo: null, googlePlacesId: 'place-2'}],
    ]);

    rerender({appointments: appointments2});

    // Should have called for the second appointment
    expect(mockRequestBusinessPhoto.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  it('should handle empty appointments array', () => {
    const appointments: any[] = [];
    const businessMap = new Map();

    renderHook(() => useFetchPhotoFallbacks(appointments, businessMap, mockRequestBusinessPhoto));

    expect(mockRequestBusinessPhoto).not.toHaveBeenCalled();
  });

  it('should handle appointment without business in map', () => {
    (isDummyPhoto as jest.Mock).mockReturnValue(true);

    const appointments = [
      {
        id: 'apt-1',
        businessId: 'b1',
        businessPhoto: null,
        businessGooglePlacesId: 'place-1',
      },
    ];

    const businessMap = new Map();

    renderHook(() => useFetchPhotoFallbacks(appointments, businessMap, mockRequestBusinessPhoto));

    expect(mockRequestBusinessPhoto).toHaveBeenCalledWith('place-1', 'b1');
  });

  it('should check isDummyPhoto for photo candidate', () => {
    const appointments = [
      {
        id: 'apt-1',
        businessId: 'b1',
        businessPhoto: 'photo.jpg',
        businessGooglePlacesId: 'place-1',
      },
    ];

    const businessMap = new Map([
      ['b1', {id: 'b1', photo: 'photo.jpg', googlePlacesId: 'place-1'}],
    ]);

    renderHook(() => useFetchPhotoFallbacks(appointments, businessMap, mockRequestBusinessPhoto));

    expect(isDummyPhoto).toHaveBeenCalledWith('photo.jpg');
  });
});
