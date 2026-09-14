import {
  subscribeTools,
  getToolsSnapshot,
  getToolsLoadingSnapshot,
  _resetToolsStoreForTesting,
} from '@/features/tasks/components/ObservationalToolBottomSheet/observationalToolsStore';
import {observationToolApi} from '@/features/observationalTools/services/observationToolService';

jest.mock(
  '@/features/observationalTools/services/observationToolService',
  () => ({
    observationToolApi: {
      list: jest.fn(),
    },
  }),
);

const flushPromises = () => new Promise(resolve => setImmediate(resolve));

describe('observationalToolsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetToolsStoreForTesting();
  });

  it('starts empty and loading', () => {
    expect(getToolsSnapshot()).toEqual([]);
    expect(getToolsLoadingSnapshot()).toBe(true);
  });

  it('fetches on the first subscription and notifies listeners once loaded', async () => {
    const tools = [{id: 'fgs', name: 'Feline Grimace Scale'}] as any;
    (observationToolApi.list as jest.Mock).mockResolvedValue(tools);

    const listener = jest.fn();
    subscribeTools(listener);
    await flushPromises();

    expect(observationToolApi.list).toHaveBeenCalledWith({onlyActive: true});
    expect(getToolsSnapshot()).toEqual(tools);
    expect(getToolsLoadingSnapshot()).toBe(false);
    expect(listener).toHaveBeenCalled();
  });

  it('does not fetch again after a successful load', async () => {
    (observationToolApi.list as jest.Mock).mockResolvedValue([]);

    subscribeTools(jest.fn());
    await flushPromises();
    subscribeTools(jest.fn());
    await flushPromises();

    expect(observationToolApi.list).toHaveBeenCalledTimes(1);
  });

  it('retries on the next subscription after a failed fetch, instead of staying empty forever', async () => {
    (observationToolApi.list as jest.Mock).mockRejectedValueOnce(
      new Error('network down'),
    );

    subscribeTools(jest.fn());
    await flushPromises();

    // A failure must not get stuck reporting "loaded" with an empty list -
    // that is exactly what silently emptied the bottom sheet for the rest
    // of the session.
    expect(getToolsLoadingSnapshot()).toBe(true);
    expect(getToolsSnapshot()).toEqual([]);

    const tools = [{id: 'caps', name: 'Canine Acute Pain Scale'}] as any;
    (observationToolApi.list as jest.Mock).mockResolvedValueOnce(tools);

    // Reopening the bottom sheet subscribes again - this must retry.
    subscribeTools(jest.fn());
    await flushPromises();

    expect(observationToolApi.list).toHaveBeenCalledTimes(2);
    expect(getToolsSnapshot()).toEqual(tools);
    expect(getToolsLoadingSnapshot()).toBe(false);
  });

  it('does not start a second fetch while one is already in flight', async () => {
    let resolveFetch: (value: any[]) => void = () => {};
    (observationToolApi.list as jest.Mock).mockReturnValue(
      new Promise(resolve => {
        resolveFetch = resolve;
      }),
    );

    subscribeTools(jest.fn());
    subscribeTools(jest.fn());
    expect(observationToolApi.list).toHaveBeenCalledTimes(1);

    resolveFetch([]);
    await flushPromises();
  });

  it('unsubscribes a listener without affecting others', async () => {
    (observationToolApi.list as jest.Mock).mockResolvedValue([]);
    const listenerA = jest.fn();
    const listenerB = jest.fn();

    const unsubscribeA = subscribeTools(listenerA);
    subscribeTools(listenerB);
    unsubscribeA();
    await flushPromises();

    expect(listenerB).toHaveBeenCalled();
  });
});
