import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchCompanions,
  addCompanion,
} from '../../../src/features/companion/thunks';
import type {
  Companion,
  AddCompanionPayload,
  Breed,
} from '../../../src/features/companion/types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.useFakeTimers();

const mockedGetItem = AsyncStorage.getItem as jest.Mock;
const mockedSetItem = AsyncStorage.setItem as jest.Mock;

let consoleLogSpy: jest.SpyInstance;
let consoleErrorSpy: jest.SpyInstance;

const createMockAddCompanionPayload = (
  overrides: Partial<AddCompanionPayload> = {},
): AddCompanionPayload => ({
  name: 'Test Name',
  category: 'dog',
  breed: null,
  dateOfBirth: '2023-01-01',
  gender: 'male',
  currentWeight: 10,
  color: 'Brown',
  allergies: null,
  neuteredStatus: 'not-neutered',
  ageWhenNeutered: null,
  bloodGroup: null,
  microchipNumber: null,
  passportNumber: null,
  insuredStatus: 'not-insured',
  insuranceCompany: null,
  insurancePolicyNumber: null,
  countryOfOrigin: null,
  origin: 'unknown',
  profileImage: null,
  ...overrides,
});

const mockBreed: Breed = {
    speciesId: 1,
    speciesName: 'Canine',
    breedId: 101,
    breedName: 'Labrador Retriever'
};

beforeEach(() => {
  mockedGetItem.mockReset();
  mockedSetItem.mockReset();
  mockDispatch.mockClear();
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

const mockDispatch = jest.fn();
const mockGetState = jest.fn();

const MOCK_EXISTING_DATE_ISO = new Date('2023-01-01T10:00:00.000Z').toISOString();
const mockBaseCompanionPayload = createMockAddCompanionPayload({ name: 'Buddy', category: 'dog', breed: mockBreed });
const mockCompanions: Companion[] = [
  {
    ...mockBaseCompanionPayload,
    id: 'c1',
    userId: 'u1',
    createdAt: MOCK_EXISTING_DATE_ISO,
    updatedAt: MOCK_EXISTING_DATE_ISO,
  },
];

describe('companion thunks', () => {
  describe('fetchCompanions', () => {
     it('should fetch companions successfully (fulfilled)', async () => {
      const userId = 'u1';
      mockedGetItem.mockResolvedValue(JSON.stringify(mockCompanions));
      const actionPromise = fetchCompanions(userId)(
        mockDispatch, mockGetState, undefined
      );
      jest.advanceTimersByTime(800);
      const result = await actionPromise;
      expect(mockedGetItem).toHaveBeenCalledWith(`companions_${userId}`);
      expect(result.type).toBe('companion/fetchCompanions/fulfilled');
      expect(result.payload).toEqual(mockCompanions);
    });

    it('should return an empty array if no companions are stored (fulfilled)', async () => {
      const userId = 'u1';
      mockedGetItem.mockResolvedValue(null);
      const actionPromise = fetchCompanions(userId)(
        mockDispatch, mockGetState, undefined
      );
      jest.advanceTimersByTime(800);
      const result = await actionPromise;
      expect(mockedGetItem).toHaveBeenCalledWith(`companions_${userId}`);
      expect(result.type).toBe('companion/fetchCompanions/fulfilled');
      expect(result.payload).toEqual([]);
    });

    it('should handle errors where error is an Error instance (rejected)', async () => {
      const userId = 'u1';
      const errorMessage = 'AsyncStorage error instance';
      mockedGetItem.mockRejectedValue(new Error(errorMessage));
      const actionPromise = fetchCompanions(userId)(
        mockDispatch, mockGetState, undefined
      );
      jest.advanceTimersByTime(800);
      const result = await actionPromise;
      expect(result.type).toBe('companion/fetchCompanions/rejected');
      expect(result.payload).toBe(errorMessage);
    });

    it('should handle errors where error is NOT an Error instance (rejected)', async () => {
      const userId = 'u1';
      const errorObject = { code: 'STORAGE_FAIL', detail: 'Disk full' };
      mockedGetItem.mockRejectedValue(errorObject);
      const actionPromise = fetchCompanions(userId)(
        mockDispatch, mockGetState, undefined
      );
      jest.advanceTimersByTime(800);
      const result = await actionPromise;
      expect(result.type).toBe('companion/fetchCompanions/rejected');
      expect(result.payload).toBe('Failed to fetch companions');
    });
  });

  describe('addCompanion', () => {
    const MOCK_TIMESTAMP = 1678886400000;
    const MOCK_ISO_STRING = new Date(MOCK_TIMESTAMP).toISOString();
    const MOCK_RANDOM_VALUE = 0.5;
    const MOCK_RANDOM_PART = MOCK_RANDOM_VALUE.toString(36).substring(2, 9);

    let mathRandomSpy: jest.SpyInstance;
    let dateNowSpy: jest.SpyInstance;
    let dateToISOStringSpy: jest.SpyInstance;

    beforeEach(() => {
        dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP);
        dateToISOStringSpy = jest.spyOn(Date.prototype, 'toISOString')
            .mockReturnValue(MOCK_ISO_STRING);

        mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(MOCK_RANDOM_VALUE);
    });

    afterEach(() => {
        mathRandomSpy.mockRestore();
        dateNowSpy.mockRestore();
        dateToISOStringSpy.mockRestore();
    });

    it('should add a new companion successfully (fulfilled)', async () => {
      const userId = 'u1';
      const payload = createMockAddCompanionPayload({ name: 'Whiskers', category: 'cat' });
      mockedGetItem.mockResolvedValue(null);
      const actionPromise = addCompanion({ userId, payload })(
        mockDispatch, mockGetState, undefined
      );
      jest.advanceTimersByTime(1000);
      const result = await actionPromise;
      const expectedId = `companion_${MOCK_TIMESTAMP}_${MOCK_RANDOM_PART}`;
      const expectedCompanion: Companion = {
        ...payload,
        id: expectedId, userId, createdAt: MOCK_ISO_STRING, updatedAt: MOCK_ISO_STRING,
      };
      expect(mockedSetItem).toHaveBeenCalledTimes(1);
      const savedDataString = mockedSetItem.mock.calls[0][1];
      const savedData = JSON.parse(savedDataString);
      expect(savedData).toEqual([expectedCompanion]);
      expect(result.type).toBe('companion/addCompanion/fulfilled');
      expect(result.payload).toEqual(expect.objectContaining(expectedCompanion));
    });

    it('should add to an existing list of companions (fulfilled)', async () => {
      const userId = 'u1';
      const payload = createMockAddCompanionPayload({ name: 'Whiskers', category: 'cat' });
      mockedGetItem.mockResolvedValue(JSON.stringify(mockCompanions));
      const actionPromise = addCompanion({ userId, payload })(
        mockDispatch, mockGetState, undefined
      );
      jest.advanceTimersByTime(1000);
      const result = await actionPromise;
      const expectedId = `companion_${MOCK_TIMESTAMP}_${MOCK_RANDOM_PART}`;
      const newCompanion: Companion = {
        ...payload,
        id: expectedId, userId, createdAt: MOCK_ISO_STRING, updatedAt: MOCK_ISO_STRING,
      };
      const expectedSavedArray: Companion[] = [...mockCompanions, newCompanion];
      expect(mockedSetItem).toHaveBeenCalledTimes(1);
      const savedDataString = mockedSetItem.mock.calls[0][1];
      const savedData = JSON.parse(savedDataString);
      expect(savedData).toEqual(expectedSavedArray);
      expect(result.type).toBe('companion/addCompanion/fulfilled');
      expect(result.payload).toEqual(expect.objectContaining(newCompanion));
    });

    it('should handle errors where error is an Error instance (rejected)', async () => {
      const userId = 'u1';
      const payload = createMockAddCompanionPayload({ name: 'Whiskers', category: 'cat' });
      const errorMessage = 'AsyncStorage setItem error instance';
      mockedGetItem.mockResolvedValue(null);
      mockedSetItem.mockRejectedValue(new Error(errorMessage));
      const actionPromise = addCompanion({ userId, payload })(
        mockDispatch, mockGetState, undefined
      );
      jest.advanceTimersByTime(1000);
      const result = await actionPromise;
      expect(result.type).toBe('companion/addCompanion/rejected');
      expect(result.payload).toBe(errorMessage);
      expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'companion/addCompanion/rejected', payload: errorMessage,
      }));
    });

    it('should handle errors where error is NOT an Error instance (rejected)', async () => {
      const userId = 'u1';
      const payload = createMockAddCompanionPayload({ name: 'Whiskers', category: 'cat' });
      const errorString = 'Just a string error';
      mockedGetItem.mockResolvedValue(null);
      mockedSetItem.mockRejectedValue(errorString);
      const actionPromise = addCompanion({ userId, payload })(
        mockDispatch, mockGetState, undefined
      );
      jest.advanceTimersByTime(1000);
      const result = await actionPromise;
      expect(result.type).toBe('companion/addCompanion/rejected');
      expect(result.payload).toBe('Failed to add companion');
      expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'companion/addCompanion/rejected', payload: 'Failed to add companion',
      }));
    });
  });
});