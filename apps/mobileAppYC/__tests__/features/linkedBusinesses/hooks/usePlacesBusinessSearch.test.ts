import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useDispatch } from 'react-redux';
import { usePlacesBusinessSearch } from '../../../../src/features/linkedBusinesses/hooks/usePlacesBusinessSearch';
import LocationService from '../../../../src/shared/services/LocationService';
import {
  checkOrganisation,
  fetchPlaceCoordinates,
  searchBusinessesByLocation,
} from '../../../../src/features/linkedBusinesses/index';

// --- Mocks ---

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
}));

jest.mock('../../../../src/shared/services/LocationService', () => ({
  getCurrentPosition: jest.fn(),
}));

jest.mock('../../../../src/features/linkedBusinesses/index', () => ({
  checkOrganisation: jest.fn(),
  fetchPlaceCoordinates: jest.fn(),
  searchBusinessesByLocation: jest.fn(),
}));

describe('usePlacesBusinessSearch', () => {
  const mockDispatch = jest.fn();
  const mockOnSelectPms = jest.fn();
  const mockOnSelectNonPms = jest.fn();
  const mockOnError = jest.fn();

  const defaultProps = {
    onSelectPms: mockOnSelectPms,
    onSelectNonPms: mockOnSelectNonPms,
    onError: mockOnError,
  };

  const mockBusiness = {
    id: 'place-123',
    name: 'Test Vet',
    address: '123 Street',
    lat: 10,
    lng: 20,
    phone: '555-5555',
    email: 'test@vet.com',
    isPMSRecord: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);

    // Setup generic dispatch behavior to handle .unwrap() pattern
    mockDispatch.mockImplementation((action: any) => {
      if (action && action.__error) {
        return { unwrap: () => Promise.reject(action.__error) };
      }
      return {
        unwrap: () => Promise.resolve(action ? action.payload : undefined),
      };
    });

    // Default Location Mock
    (LocationService.getCurrentPosition as jest.Mock).mockResolvedValue({
      latitude: 50,
      longitude: 50,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization & Search Logic', () => {
    it('fetches user location on mount', async () => {
      renderHook(() => usePlacesBusinessSearch(defaultProps));

      await waitFor(() => {
        expect(LocationService.getCurrentPosition).toHaveBeenCalled();
      });
    });

    it('handles location fetch failure gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      (LocationService.getCurrentPosition as jest.Mock).mockRejectedValue(new Error('Location off'));

      renderHook(() => usePlacesBusinessSearch(defaultProps));

      await waitFor(() => {
        expect(LocationService.getCurrentPosition).toHaveBeenCalled();
      });
      // Should not crash, just logs
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Location unavailable'),
        expect.anything()
      );
      consoleSpy.mockRestore();
    });

    it('does not search if query length is below minCharacters', () => {
      const { result } = renderHook(() => usePlacesBusinessSearch(defaultProps));

      act(() => {
        result.current.handleSearchChange('ab');
      });

      // Fast forward
      jest.advanceTimersByTime(1000);

      expect(searchBusinessesByLocation).not.toHaveBeenCalled();
      expect(result.current.searchResults).toEqual([]);
    });

    it('debounces search calls', async () => {
      const { result } = renderHook(() => usePlacesBusinessSearch(defaultProps));

      // FIX: Wait for location to initialize before searching
      await waitFor(() => {
        expect(LocationService.getCurrentPosition).toHaveBeenCalled();
      });

      (searchBusinessesByLocation as unknown as jest.Mock).mockReturnValue({ payload: [] });

      act(() => {
        result.current.handleSearchChange('abc');
      });
      act(() => {
        result.current.handleSearchChange('abcd');
      });

      // Advance time but not enough for debounce
      jest.advanceTimersByTime(400);
      expect(searchBusinessesByLocation).not.toHaveBeenCalled();

      // Advance past debounce
      jest.advanceTimersByTime(500);

      expect(searchBusinessesByLocation).toHaveBeenCalledTimes(1);
      expect(searchBusinessesByLocation).toHaveBeenCalledWith(expect.objectContaining({
        query: 'abcd',
        location: { latitude: 50, longitude: 50 }
      }));
    });

    it('updates searchResults on successful search', async () => {
      const { result } = renderHook(() => usePlacesBusinessSearch(defaultProps));

      // FIX: Wait for location here too, just to be safe
      await waitFor(() => {
        expect(LocationService.getCurrentPosition).toHaveBeenCalled();
      });

      const mockResults = [mockBusiness];
      (searchBusinessesByLocation as unknown as jest.Mock).mockReturnValue({ payload: mockResults });

      act(() => {
        result.current.handleSearchChange('vet clinic');
      });

      await act(async () => {
        jest.advanceTimersByTime(800);
      });

      expect(result.current.searchResults).toEqual(mockResults);
      expect(result.current.searching).toBe(false);
    });

    it('handles search errors', async () => {
      const error = new Error('API Error');
      const { result } = renderHook(() => usePlacesBusinessSearch(defaultProps));
      (searchBusinessesByLocation as unknown as jest.Mock).mockReturnValue({ __error: error });

      act(() => {
        result.current.handleSearchChange('fail query');
      });

      await act(async () => {
        jest.advanceTimersByTime(800);
      });

      expect(mockOnError).toHaveBeenCalledWith(error);
      expect(result.current.searching).toBe(false);
    });

    it('clears results', () => {
      const { result } = renderHook(() => usePlacesBusinessSearch(defaultProps));

      act(() => {
        result.current.clearResults();
      });
      expect(result.current.searchResults).toEqual([]);
    });
  });

  describe('Selection Logic', () => {
    it('selects a PMS organisation successfully', async () => {
      const { result } = renderHook(() => usePlacesBusinessSearch(defaultProps));

      const checkResult = {
        isPmsOrganisation: true,
        organisationId: 'org-1',
        website: 'vet.com'
      };
      (checkOrganisation as unknown as jest.Mock).mockReturnValue({ payload: checkResult });

      await act(async () => {
        await result.current.handleSelectBusiness(mockBusiness);
      });

      expect(checkOrganisation).toHaveBeenCalledWith(expect.objectContaining({
        placeId: mockBusiness.id,
        lat: 10,
        lng: 20
      }));

      expect(mockOnSelectPms).toHaveBeenCalledWith(expect.objectContaining({
        id: mockBusiness.id,
        isPmsOrganisation: true,
        organisationId: 'org-1'
      }));
      expect(mockOnSelectNonPms).not.toHaveBeenCalled();
    });

    it('selects a Non-PMS organisation successfully', async () => {
      const { result } = renderHook(() => usePlacesBusinessSearch(defaultProps));

      const checkResult = {
        isPmsOrganisation: false,
        organisationId: null,
      };
      (checkOrganisation as unknown as jest.Mock).mockReturnValue({ payload: checkResult });

      await act(async () => {
        await result.current.handleSelectBusiness(mockBusiness);
      });

      expect(mockOnSelectNonPms).toHaveBeenCalledWith(expect.objectContaining({
        id: mockBusiness.id,
        isPmsOrganisation: false
      }));
      expect(mockOnSelectPms).not.toHaveBeenCalled();
    });

    it('fetches coordinates if missing from business result', async () => {
      const { result } = renderHook(() => usePlacesBusinessSearch(defaultProps));
      const businessNoCoords = { ...mockBusiness, lat: undefined, lng: undefined };

      (fetchPlaceCoordinates as unknown as jest.Mock).mockReturnValue({ payload: { latitude: 88, longitude: 99 } });
      (checkOrganisation as unknown as jest.Mock).mockReturnValue({ payload: { isPmsOrganisation: false } });

      await act(async () => {
        await result.current.handleSelectBusiness(businessNoCoords as any);
      });

      expect(fetchPlaceCoordinates).toHaveBeenCalledWith(businessNoCoords.id);
      expect(checkOrganisation).toHaveBeenCalledWith(expect.objectContaining({
        lat: 88,
        lng: 99
      }));
    });

    it('falls back to Non-PMS if fetching coordinates fails', async () => {
      const { result } = renderHook(() => usePlacesBusinessSearch(defaultProps));
      const businessNoCoords = { ...mockBusiness, lat: undefined, lng: undefined };
      const error = new Error('No Coords');

      (fetchPlaceCoordinates as unknown as jest.Mock).mockReturnValue({ __error: error });

      await act(async () => {
        await result.current.handleSelectBusiness(businessNoCoords as any);
      });

      expect(mockOnError).toHaveBeenCalledWith(error);
      // Fallback selection should maintain the undefined coords but process selection
      expect(mockOnSelectNonPms).toHaveBeenCalledWith(expect.objectContaining({
        placeId: businessNoCoords.id,
        isPmsOrganisation: false,
        lat: undefined,
        lng: undefined
      }));
      expect(checkOrganisation).not.toHaveBeenCalled();
    });

    it('falls back to Non-PMS if organisation check fails', async () => {
      const { result } = renderHook(() => usePlacesBusinessSearch(defaultProps));
      const error = new Error('Network fail');

      (checkOrganisation as unknown as jest.Mock).mockReturnValue({ __error: error });

      await act(async () => {
        await result.current.handleSelectBusiness(mockBusiness);
      });

      expect(mockOnError).toHaveBeenCalledWith(error);
      expect(mockOnSelectNonPms).toHaveBeenCalledWith(expect.objectContaining({
        placeId: mockBusiness.id,
        isPmsOrganisation: false
      }));
    });
  });
});