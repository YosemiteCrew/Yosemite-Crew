'use client';

import React, {
  createContext,
  useContext,
  useMemo,
  ReactNode,
  useEffect,
  useSyncExternalStore,
} from 'react';
import type {
  ExtensionContext,
  ExtensionPointId,
  PluginManifest,
  RegisteredExtension,
} from './types';
import { extensionRegistry, registerPlugin, unregisterPlugin } from './registry';

interface PluginProviderProps {
  readonly children: ReactNode;
  readonly initialPlugins?: PluginManifest[];
}

const EMPTY_PLUGINS: PluginManifest[] = [];
const EMPTY_EXTENSIONS: never[] = [];

const PluginContext = createContext<{
  registerPlugin: (manifest: PluginManifest) => void;
  unregisterPlugin: (pluginId: string) => void;
  getPlugins: () => PluginManifest[];
  hasPlugin: (pluginId: string) => boolean;
} | null>(null);

export function PluginProvider({ children, initialPlugins = EMPTY_PLUGINS }: PluginProviderProps) {
  useEffect(() => {
    for (const plugin of initialPlugins) {
      registerPlugin(plugin);
    }
    return () => {
      for (const plugin of initialPlugins) {
        unregisterPlugin(plugin.id);
      }
    };
  }, [initialPlugins]);

  const value = useMemo(
    () => ({
      registerPlugin,
      unregisterPlugin,
      getPlugins: () => extensionRegistry.getAllPlugins(),
      hasPlugin: (pluginId: string) => extensionRegistry.hasPlugin(pluginId),
    }),
    []
  );

  return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>;
}

export function usePluginRegistry() {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error('usePluginRegistry must be used within a PluginProvider');
  }
  return context;
}

export function useExtensionPoint<T = Record<string, unknown>>(
  extensionPointId: ExtensionPointId,
  context: ExtensionContext
): {
  extensions: RegisteredExtension<T>[];
} {
  const version = useSyncExternalStore(
    extensionRegistry.subscribe,
    extensionRegistry.getVersion,
    extensionRegistry.getServerVersion
  );
  const snapshot = useMemo(() => {
    try {
      return {
        version,
        extensions: extensionRegistry.getExtensions<T>(extensionPointId, context),
      };
    } catch {
      return { version, extensions: EMPTY_EXTENSIONS };
    }
  }, [context, extensionPointId, version]);

  return { extensions: snapshot.extensions };
}
