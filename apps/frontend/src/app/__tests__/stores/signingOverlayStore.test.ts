import { useSigningOverlayStore } from '@/app/stores/signingOverlayStore';

describe('signingOverlayStore', () => {
  beforeEach(() => {
    useSigningOverlayStore.setState({
      open: false,
      url: null,
      pending: false,
      submissionId: null,
    });
  });

  it('starts with default closed state', () => {
    const state = useSigningOverlayStore.getState();
    expect(state.open).toBe(false);
    expect(state.url).toBeNull();
    expect(state.pending).toBe(false);
    expect(state.submissionId).toBeNull();
  });

  it('openOverlay sets open, pending, submissionId and clears url', () => {
    useSigningOverlayStore.getState().openOverlay('sub-123');
    const state = useSigningOverlayStore.getState();
    expect(state.open).toBe(true);
    expect(state.pending).toBe(true);
    expect(state.submissionId).toBe('sub-123');
    expect(state.url).toBeNull();
  });

  it('setUrl sets url, clears pending, keeps open', () => {
    useSigningOverlayStore.getState().openOverlay('sub-123');
    useSigningOverlayStore.getState().setUrl('https://example.com/sign');
    const state = useSigningOverlayStore.getState();
    expect(state.url).toBe('https://example.com/sign');
    expect(state.pending).toBe(false);
    expect(state.open).toBe(true);
  });

  it('close resets all state', () => {
    useSigningOverlayStore.getState().openOverlay('sub-123');
    useSigningOverlayStore.getState().setUrl('https://example.com/sign');
    useSigningOverlayStore.getState().close();

    const state = useSigningOverlayStore.getState();
    expect(state.open).toBe(false);
    expect(state.url).toBeNull();
    expect(state.pending).toBe(false);
    expect(state.submissionId).toBeNull();
  });
});
