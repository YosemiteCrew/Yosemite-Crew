import {renderHook} from '@testing-library/react-native';
import {useNavigation} from '@react-navigation/native';
import {Alert} from 'react-native';
import {useOrganisationDocumentNavigation} from '../../src/shared/hooks/useOrganisationDocumentNavigation';

// --- Mocks ---

// Mock Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('useOrganisationDocumentNavigation Hook', () => {
  const mockNavigate = jest.fn();
  const mockOrganisationId = 'org-123';
  const mockOrganisationName = 'Test Org';

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
    });
  });

  // ===========================================================================
  // 1. Success Scenarios (Navigation)
  // ===========================================================================

  it('navigates to Terms & Conditions with correct params', () => {
    const {result} = renderHook(() =>
      useOrganisationDocumentNavigation({
        organisationId: mockOrganisationId,
        organisationName: mockOrganisationName,
      }),
    );

    result.current.openTerms();

    expect(mockNavigate).toHaveBeenCalledWith('OrganisationDocument', {
      organisationId: mockOrganisationId,
      organisationName: mockOrganisationName,
      category: 'TERMS_AND_CONDITIONS',
    });
  });

  it('navigates to Privacy Policy with correct params', () => {
    const {result} = renderHook(() =>
      useOrganisationDocumentNavigation({
        organisationId: mockOrganisationId,
        organisationName: mockOrganisationName,
      }),
    );

    result.current.openPrivacy();

    expect(mockNavigate).toHaveBeenCalledWith('OrganisationDocument', {
      organisationId: mockOrganisationId,
      organisationName: mockOrganisationName,
      category: 'PRIVACY_POLICY',
    });
  });

  it('navigates to Cancellation Policy with correct params', () => {
    const {result} = renderHook(() =>
      useOrganisationDocumentNavigation({
        organisationId: mockOrganisationId,
        organisationName: mockOrganisationName,
      }),
    );

    result.current.openCancellation();

    expect(mockNavigate).toHaveBeenCalledWith('OrganisationDocument', {
      organisationId: mockOrganisationId,
      organisationName: mockOrganisationName,
      category: 'CANCELLATION_POLICY',
    });
  });

  it('handles missing organisationName gracefully (passes undefined)', () => {
    const {result} = renderHook(() =>
      useOrganisationDocumentNavigation({
        organisationId: mockOrganisationId,
        organisationName: null, // Simulate missing name
      }),
    );

    result.current.openTerms();

    expect(mockNavigate).toHaveBeenCalledWith('OrganisationDocument', {
      organisationId: mockOrganisationId,
      organisationName: undefined, // Expect undefined, not null
      category: 'TERMS_AND_CONDITIONS',
    });
  });

  // ===========================================================================
  // 2. Error Scenarios (Alerts)
  // ===========================================================================

  it('shows an alert and does NOT navigate if organisationId is missing (null)', () => {
    const {result} = renderHook(() =>
      useOrganisationDocumentNavigation({
        organisationId: null,
        organisationName: mockOrganisationName,
      }),
    );

    result.current.openTerms();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Unavailable',
      'We could not find this business right now. Please try again.',
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows an alert and does NOT navigate if organisationId is missing (undefined)', () => {
    const {result} = renderHook(() =>
      useOrganisationDocumentNavigation({
        organisationId: undefined,
        organisationName: mockOrganisationName,
      }),
    );

    result.current.openPrivacy();

    expect(Alert.alert).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});