import React, { type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { logger } from '@/app/lib/logger';
import {
  extensionRegistry,
  getAllPlugins,
  getExtensionComponents,
  getExtensions,
  hasPlugin,
  registerPlugin,
  unregisterPlugin,
  useExtensionPointSync,
} from '@/app/features/plugins/registry';
import {
  PluginProvider,
  useExtensionPoint,
  usePluginRegistry,
} from '@/app/features/plugins/PluginProvider';
import type {
  ExtensionContext,
  PluginExtension,
  PluginManifest,
} from '@/app/features/plugins/types';

const context: ExtensionContext = { type: 'forms.list', organisationId: 'org-1' };
const TestComponent: React.FC<Record<string, unknown>> = () => null;

const makeExtension = (
  id: string,
  priority?: number,
  when?: PluginExtension['when']
): PluginExtension => ({
  id,
  extensionPointId: 'forms.list.actions',
  component: TestComponent,
  priority,
  when,
});

const makeManifest = (
  id: string,
  extensions = [makeExtension(`${id}-action`)]
): PluginManifest => ({
  id,
  name: id,
  version: '1.0.0',
  extensions,
});

describe('plugin extension registry', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    extensionRegistry.clear();
  });

  it('orders registered actions by priority and exposes registry helpers', () => {
    registerPlugin(makeManifest('low', [makeExtension('low-action', 1)]));
    registerPlugin(makeManifest('high', [makeExtension('high-action', 5)]));

    expect(getExtensions('forms.list.actions', context).map(({ pluginId }) => pluginId)).toEqual([
      'high',
      'low',
    ]);
    expect(getExtensionComponents('forms.list.actions', context).map(({ id }) => id)).toEqual([
      'high-action',
      'low-action',
    ]);
    expect(useExtensionPointSync('forms.list.actions', context).extensions).toHaveLength(2);
    expect(getAllPlugins().map(({ id }) => id)).toEqual(['low', 'high']);
    expect(extensionRegistry.getPlugin('high')).toEqual(
      makeManifest('high', [makeExtension('high-action', 5)])
    );
    expect(hasPlugin('high')).toBe(true);
    expect(hasPlugin('missing')).toBe(false);

    unregisterPlugin('high');
    unregisterPlugin('missing');
    expect(getExtensions('forms.list.actions', context).map(({ pluginId }) => pluginId)).toEqual([
      'low',
    ]);
  });

  it('filters extensions by context and skips extensions with failing conditions', () => {
    registerPlugin(
      makeManifest('filters', [
        makeExtension('unconditional'),
        makeExtension('included', 3, () => true),
        makeExtension('excluded', 2, () => false),
        makeExtension('broken', 4, () => {
          throw new Error('condition failed');
        }),
      ])
    );

    expect(
      getExtensions('forms.list.actions', context).map(({ extension }) => extension.id)
    ).toEqual(['included', 'unconditional']);
  });

  it('ignores duplicate plugins, unregisters extensions, and clears state', () => {
    const warningSpy = jest.spyOn(logger, 'warn');
    const original = makeManifest('duplicate');
    registerPlugin(original);
    registerPlugin(makeManifest('duplicate', [makeExtension('ignored-action')]));

    expect(warningSpy).toHaveBeenCalledWith('Plugin duplicate is already registered');
    expect(
      getExtensions('forms.list.actions', context).map(({ extension }) => extension.id)
    ).toEqual(['duplicate-action']);

    unregisterPlugin('duplicate');
    expect(getExtensions('forms.list.actions', context)).toEqual([]);
    registerPlugin(original);
    extensionRegistry.clear();
    expect(getAllPlugins()).toEqual([]);
  });

  it('returns matching registered extensions from the async hook', async () => {
    registerPlugin(makeManifest('hook'));

    const { result } = renderHook(() => useExtensionPoint('forms.list.actions', context));
    await waitFor(() => expect(result.current.extensions).toHaveLength(1));
    expect(result.current.extensions[0].extension.id).toBe('hook-action');
    expect(result.current.extensions[0].pluginId).toBe('hook');
  });

  it('updates the extension point when plugins register and unregister', async () => {
    const { result } = renderHook(() => useExtensionPoint('forms.list.actions', context));

    expect(result.current.extensions).toEqual([]);
    act(() => registerPlugin(makeManifest('hook')));
    await waitFor(() => expect(result.current.extensions).toHaveLength(1));

    act(() => unregisterPlugin('hook'));
    await waitFor(() => expect(result.current.extensions).toEqual([]));
  });

  it('returns an empty list when the registry lookup throws', async () => {
    jest.spyOn(extensionRegistry, 'getExtensions').mockImplementationOnce(() => {
      throw new Error('registry unavailable');
    });

    const { result } = renderHook(() => useExtensionPoint('forms.list.actions', context));
    await waitFor(() => expect(result.current.extensions).toEqual([]));
  });

  it('registers initial plugins in the provider and removes them on unmount', async () => {
    const initialPlugins = [makeManifest('provider')];
    const wrapper = ({ children }: PropsWithChildren) => (
      <PluginProvider initialPlugins={initialPlugins}>{children}</PluginProvider>
    );
    const { result, unmount } = renderHook(() => usePluginRegistry(), { wrapper });

    await waitFor(() => expect(result.current.hasPlugin('provider')).toBe(true));
    expect(result.current.getPlugins().map(({ id }) => id)).toEqual(['provider']);
    unmount();
    expect(hasPlugin('provider')).toBe(false);
  });

  it('requires the plugin registry hook to be inside its provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => usePluginRegistry())).toThrow(
      'usePluginRegistry must be used within a PluginProvider'
    );
    consoleSpy.mockRestore();
  });
});
