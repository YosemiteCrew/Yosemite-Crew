import { useUniversalSearchStore } from '@/app/stores/universalSearchStore';

describe('universalSearchStore', () => {
  beforeEach(() => {
    useUniversalSearchStore.setState({ isOpen: false });
  });

  it('starts closed', () => {
    expect(useUniversalSearchStore.getState().isOpen).toBe(false);
  });

  it('open sets isOpen to true', () => {
    useUniversalSearchStore.getState().open();
    expect(useUniversalSearchStore.getState().isOpen).toBe(true);
  });

  it('close sets isOpen to false', () => {
    useUniversalSearchStore.getState().open();
    useUniversalSearchStore.getState().close();
    expect(useUniversalSearchStore.getState().isOpen).toBe(false);
  });

  it('toggle opens when closed', () => {
    useUniversalSearchStore.getState().toggle();
    expect(useUniversalSearchStore.getState().isOpen).toBe(true);
  });

  it('toggle closes when open', () => {
    useUniversalSearchStore.getState().open();
    useUniversalSearchStore.getState().toggle();
    expect(useUniversalSearchStore.getState().isOpen).toBe(false);
  });

  it('toggle can be called multiple times', () => {
    useUniversalSearchStore.getState().toggle();
    useUniversalSearchStore.getState().toggle();
    useUniversalSearchStore.getState().toggle();
    expect(useUniversalSearchStore.getState().isOpen).toBe(true);
  });
});
