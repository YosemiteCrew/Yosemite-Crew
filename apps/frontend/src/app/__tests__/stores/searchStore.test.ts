import { useSearchStore } from '@/app/stores/searchStore';

describe('searchStore', () => {
  beforeEach(() => {
    useSearchStore.setState({ query: '' });
  });

  it('starts with empty query', () => {
    expect(useSearchStore.getState().query).toBe('');
  });

  it('setQuery updates the query', () => {
    useSearchStore.getState().setQuery('Luna');
    expect(useSearchStore.getState().query).toBe('Luna');
  });

  it('setQuery can be called multiple times', () => {
    useSearchStore.getState().setQuery('first');
    useSearchStore.getState().setQuery('second');
    expect(useSearchStore.getState().query).toBe('second');
  });

  it('clear resets the query to empty string', () => {
    useSearchStore.getState().setQuery('some search text');
    useSearchStore.getState().clear();
    expect(useSearchStore.getState().query).toBe('');
  });
});
