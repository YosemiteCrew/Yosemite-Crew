import {fetchBusinessFallbackPhoto} from '@/features/appointments/utils/businessFallbackPhoto';
import {
  fetchBusinessDetails,
  fetchGooglePlacesImage,
} from '@/features/linkedBusinesses';

jest.mock('@/features/linkedBusinesses', () => ({
  fetchBusinessDetails: jest.fn((placeId: string) => ({
    type: 'details',
    placeId,
  })),
  fetchGooglePlacesImage: jest.fn((placeId: string) => ({
    type: 'image',
    placeId,
  })),
}));

type Outcome = {ok: true; value: unknown} | {ok: false; error: unknown};

const makeDispatch = (outcomes: Record<'details' | 'image', Outcome>) =>
  jest.fn((action: {type: 'details' | 'image'}) => {
    const outcome = outcomes[action.type];
    return {
      unwrap: () =>
        outcome.ok
          ? Promise.resolve(outcome.value)
          : Promise.reject(outcome.error),
    };
  }) as any;

describe('fetchBusinessFallbackPhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the Places details photo without asking for the Places image', async () => {
    const dispatch = makeDispatch({
      details: {ok: true, value: {photoUrl: 'https://img/details.jpg'}},
      image: {ok: true, value: {photoUrl: 'https://img/image.jpg'}},
    });

    await expect(fetchBusinessFallbackPhoto(dispatch, 'place-1')).resolves.toBe(
      'https://img/details.jpg',
    );
    expect(fetchBusinessDetails).toHaveBeenCalledWith('place-1');
    expect(fetchGooglePlacesImage).not.toHaveBeenCalled();
  });

  it('resolves to null when the details lookup succeeds without a photo', async () => {
    const dispatch = makeDispatch({
      details: {ok: true, value: {photoUrl: undefined}},
      image: {ok: true, value: {photoUrl: 'https://img/image.jpg'}},
    });

    await expect(
      fetchBusinessFallbackPhoto(dispatch, 'place-1'),
    ).resolves.toBeNull();
    expect(fetchGooglePlacesImage).not.toHaveBeenCalled();
  });

  it('falls back to the Places image when the details lookup fails', async () => {
    const dispatch = makeDispatch({
      details: {ok: false, error: new Error('details failed')},
      image: {ok: true, value: {photoUrl: 'https://img/image.jpg'}},
    });

    await expect(fetchBusinessFallbackPhoto(dispatch, 'place-2')).resolves.toBe(
      'https://img/image.jpg',
    );
    expect(fetchGooglePlacesImage).toHaveBeenCalledWith('place-2');
  });

  it('resolves to null when the Places image has no photo', async () => {
    const dispatch = makeDispatch({
      details: {ok: false, error: new Error('details failed')},
      image: {ok: true, value: {photoUrl: null}},
    });

    await expect(
      fetchBusinessFallbackPhoto(dispatch, 'place-3'),
    ).resolves.toBeNull();
  });

  it('resolves to null instead of rejecting when both lookups fail', async () => {
    const dispatch = makeDispatch({
      details: {ok: false, error: new Error('details failed')},
      image: {ok: false, error: new Error('image failed')},
    });

    await expect(
      fetchBusinessFallbackPhoto(dispatch, 'place-4'),
    ).resolves.toBeNull();
  });
});
