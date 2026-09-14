import {
  observationToolApi,
  type ObservationToolDefinitionRemote,
} from '@/features/observationalTools/services/observationToolService';

let _tools: ObservationToolDefinitionRemote[] = [];
let _toolsLoaded = false;
let _toolsFetching = false;
const _toolsListeners = new Set<() => void>();

function _notifyTools() {
  _toolsListeners.forEach(l => l());
}

function _startFetchTools() {
  // `_toolsLoaded` only flips to true on a successful fetch below, so a
  // failure leaves it false and the next subscribeTools() call (e.g.
  // reopening the bottom sheet) retries instead of leaving the tool list
  // empty for the rest of the session.
  if (_toolsFetching || _toolsLoaded) return;
  _toolsFetching = true;
  observationToolApi
    .list({onlyActive: true})
    .then(list => {
      _tools = list;
      _toolsLoaded = true;
    })
    .catch(error => {
      console.warn(
        '[ObservationalToolBottomSheet] Failed to fetch tools',
        error,
      );
    })
    .finally(() => {
      _toolsFetching = false;
      _notifyTools();
    });
}

export function subscribeTools(listener: () => void) {
  _toolsListeners.add(listener);
  _startFetchTools();
  return () => {
    _toolsListeners.delete(listener);
  };
}

export function getToolsSnapshot(): ObservationToolDefinitionRemote[] {
  return _tools;
}

export function getToolsLoadingSnapshot(): boolean {
  return !_toolsLoaded;
}

export function _resetToolsStoreForTesting() {
  _tools = [];
  _toolsLoaded = false;
  _toolsFetching = false;
  _toolsListeners.clear();
}
