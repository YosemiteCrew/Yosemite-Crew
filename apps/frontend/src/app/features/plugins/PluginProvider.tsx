'use client';

import React, { createContext, useContext, useMemo, ReactNode, useEffect, useState } from 'react';
import type { PluginManifest, ExtensionContext } from './types';
import { extensionRegistry, registerPlugin, unregisterPlugin } from './registry';

interface PluginProviderProps {
  children: ReactNode;
  initialPlugins?: PluginManifest[];
}

const PluginContext = createContext<{
  registerPlugin: (manifest: PluginManifest) => void;
  unregisterPlugin: (pluginId: string) => void;
  getPlugins: () => PluginManifest[];
  hasPlugin: (pluginId: string) => boolean;
} | null>(null);

export function PluginProvider({ children, initialPlugins = [] }: PluginProviderProps) {
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
  extensionPointId: string,
  context: ExtensionContext
): {
  extensions: Array<{ id: string; component: React.ComponentType<T>; pluginId: string }>;
} {
  const [extensions, setExtensions] = useState<
    Array<{ id: string; component: React.ComponentType<T>; pluginId: string }>
  >([]);

  useEffect(() => {
    let mounted = true;
    try {
      const ext = extensionRegistry.getExtensionComponents<T>(extensionPointId as any, context);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (mounted) setExtensions(ext);
    } catch {
      // Extension registry not available (e.g., in tests without PluginProvider)

      if (mounted) setExtensions([]);
    }
    return () => {
      mounted = false;
    };
  }, [extensionPointId, context]);

  return { extensions };
}
