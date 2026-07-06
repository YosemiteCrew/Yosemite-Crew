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
  if (_toolsFetching) return;
  _toolsFetching = true;
  observationToolApi
    .list({onlyActive: true})
    .then(list => {
      _tools = list;
    })
    .catch(error => {
      console.warn(
        '[ObservationalToolBottomSheet] Failed to fetch tools',
        error,
      );
    })
    .finally(() => {
      _toolsLoaded = true;
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
