import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import {
  AdverseEventReportProvider,
  useAdverseEventReport,
} from '../../../../src/features/adverseEventReporting/state/AdverseEventReportContext';

// --- Helper Component ---
// A simple component to consume the context and expose methods/state to tests
const TestConsumer = () => {
  const {
    draft,
    updateDraft,
    setProductInfo,
    setConsentToContact,
    setReporterType,
    resetDraft,
  } = useAdverseEventReport();

  return (
    <View>
      <Text testID="draft-reporter-type">{draft.reporterType}</Text>
      <Text testID="draft-consent">
        {draft.consentToContact ? 'Consent Given' : 'No Consent'}
      </Text>
      <Text testID="draft-product-info">
        {draft.productInfo ? JSON.stringify(draft.productInfo) : 'No Product'}
      </Text>
      <Text testID="draft-companion-id">{draft.companionId ?? 'null'}</Text>

      <TouchableOpacity
        testID="btn-set-reporter-vet"
        onPress={() => setReporterType('veterinarian')}>
        <Text>Set Vet</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="btn-set-consent-true"
        onPress={() => setConsentToContact(true)}>
        <Text>Give Consent</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="btn-update-draft-companion"
        onPress={() => updateDraft({companionId: '123'})}>
        <Text>Set Companion</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="btn-set-product-info"
        onPress={() =>
          setProductInfo({
            productName: 'Test Product',
            // Cast as any if Typescript complains about partial mock data depending on your type defs
            // assuming 'productName' is part of AdverseEventProductInfo
          } as any)
        }>
        <Text>Set Product</Text>
      </TouchableOpacity>

      <TouchableOpacity testID="btn-reset-draft" onPress={resetDraft}>
        <Text>Reset</Text>
      </TouchableOpacity>
    </View>
  );
};

describe('AdverseEventReportContext', () => {
  // --- 1. Initial State & Basic Rendering ---
  it('provides the correct initial draft state', () => {
    const {getByTestId} = render(
      <AdverseEventReportProvider>
        <TestConsumer />
      </AdverseEventReportProvider>,
    );

    expect(getByTestId('draft-reporter-type').props.children).toBe('parent');
    expect(getByTestId('draft-consent').props.children).toBe('No Consent');
    expect(getByTestId('draft-product-info').props.children).toBe('No Product');
    expect(getByTestId('draft-companion-id').props.children).toBe('null');
  });

  // --- 2. State Updates (Methods) ---

  it('updates reporterType correctly via setReporterType', () => {
    const {getByTestId} = render(
      <AdverseEventReportProvider>
        <TestConsumer />
      </AdverseEventReportProvider>,
    );

    fireEvent.press(getByTestId('btn-set-reporter-vet'));
    expect(getByTestId('draft-reporter-type').props.children).toBe(
      'veterinarian',
    );
  });

  it('updates consentToContact correctly via setConsentToContact', () => {
    const {getByTestId} = render(
      <AdverseEventReportProvider>
        <TestConsumer />
      </AdverseEventReportProvider>,
    );

    fireEvent.press(getByTestId('btn-set-consent-true'));
    expect(getByTestId('draft-consent').props.children).toBe('Consent Given');
  });

  it('updates arbitrary draft fields correctly via updateDraft', () => {
    const {getByTestId} = render(
      <AdverseEventReportProvider>
        <TestConsumer />
      </AdverseEventReportProvider>,
    );

    fireEvent.press(getByTestId('btn-update-draft-companion'));
    expect(getByTestId('draft-companion-id').props.children).toBe('123');
  });

  it('updates productInfo correctly via setProductInfo', () => {
    const {getByTestId} = render(
      <AdverseEventReportProvider>
        <TestConsumer />
      </AdverseEventReportProvider>,
    );

    fireEvent.press(getByTestId('btn-set-product-info'));
    const productText = getByTestId('draft-product-info').props.children;
    expect(productText).toContain('Test Product');
  });

  // --- 3. Reset Functionality ---

  it('resets the draft to initial state via resetDraft', () => {
    const {getByTestId} = render(
      <AdverseEventReportProvider>
        <TestConsumer />
      </AdverseEventReportProvider>,
    );

    // 1. Modify state first
    fireEvent.press(getByTestId('btn-set-reporter-vet'));
    fireEvent.press(getByTestId('btn-set-consent-true'));

    // Verify modification happened
    expect(getByTestId('draft-reporter-type').props.children).toBe(
      'veterinarian',
    );

    // 2. Reset
    fireEvent.press(getByTestId('btn-reset-draft'));

    // 3. Verify reset to initial defaults
    expect(getByTestId('draft-reporter-type').props.children).toBe('parent');
    expect(getByTestId('draft-consent').props.children).toBe('No Consent');
  });

  // --- 4. Error Handling (Hook misuse) ---

  it('throws an error if useAdverseEventReport is used outside of Provider', () => {
    // Suppress console.error to avoid noise in test output from the thrown error
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />); // No Provider wrapping it
    }).toThrow(
      'useAdverseEventReport must be used within an AdverseEventReportProvider',
    );

    consoleSpy.mockRestore();
  });
});
