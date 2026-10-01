'use client';

import type {
  ExtensionPointId,
  PluginExtension,
  PluginManifest,
  ExtensionContext,
  RegisteredExtension,
} from './types';
import { logger } from '@/app/lib/logger';

class ExtensionRegistry {
  private readonly extensions: Map<ExtensionPointId, RegisteredExtension[]> = new Map();
  private readonly plugins: Map<string, PluginManifest> = new Map();
  private version = 0;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = () => this.version;

  getServerVersion = () => this.version;

  private notifyChange(): void {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  registerPlugin(manifest: PluginManifest): void {
    if (this.plugins.has(manifest.id)) {
      logger.warn(`Plugin ${manifest.id} is already registered`);
      return;
    }

    this.plugins.set(manifest.id, manifest);

    for (const extension of manifest.extensions) {
      this.registerExtension(manifest.id, manifest.name, extension);
    }
    this.notifyChange();
  }

  unregisterPlugin(pluginId: string): void {
    const manifest = this.plugins.get(pluginId);
    if (!manifest) return;

    for (const extension of manifest.extensions) {
      this.unregisterExtension(pluginId, extension.extensionPointId, extension.id);
    }

    this.plugins.delete(pluginId);
    this.notifyChange();
  }

  private registerExtension(
    pluginId: string,
    pluginName: string,
    extension: PluginExtension
  ): void {
    const key = extension.extensionPointId;
    const existing = this.extensions.get(key) || [];

    const registered: RegisteredExtension = {
      pluginId,
      pluginName,
      extension,
    };

    existing.push(registered);
    existing.sort((a, b) => (b.extension.priority ?? 0) - (a.extension.priority ?? 0));
    this.extensions.set(key, existing);
  }

  private unregisterExtension(
    pluginId: string,
    extensionPointId: ExtensionPointId,
    extensionId: string
  ): void {
    const existing = this.extensions.get(extensionPointId);
    if (!existing) return;

    const filtered = existing.filter(
      (e) => e.pluginId !== pluginId || e.extension.id !== extensionId
    );
    this.extensions.set(extensionPointId, filtered);
  }

  getExtensions<T = Record<string, unknown>>(
    extensionPointId: ExtensionPointId,
    context: ExtensionContext
  ): RegisteredExtension<T>[] {
    const all = this.extensions.get(extensionPointId) || [];
    return all.filter((reg) => {
      if (!reg.extension.when) return true;
      try {
        return reg.extension.when(context);
      } catch {
        return false;
      }
    }) as RegisteredExtension<T>[];
  }

  getExtensionComponents<T = Record<string, unknown>>(
    extensionPointId: ExtensionPointId,
    context: ExtensionContext
  ): Array<{ id: string; component: React.ComponentType<T>; pluginId: string }> {
    return this.getExtensions<T>(extensionPointId, context).map((reg) => ({
      id: reg.extension.id,
      component: reg.extension.component,
      pluginId: reg.pluginId,
    }));
  }

  getPlugin(pluginId: string): PluginManifest | undefined {
    return this.plugins.get(pluginId);
  }

  getAllPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values());
  }

  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  clear(): void {
    this.extensions.clear();
    this.plugins.clear();
    this.notifyChange();
  }
}

export const extensionRegistry = new ExtensionRegistry();

export function registerPlugin(manifest: PluginManifest): void {
  extensionRegistry.registerPlugin(manifest);
}

export function unregisterPlugin(pluginId: string): void {
  extensionRegistry.unregisterPlugin(pluginId);
}

export function useExtensionPointSync<T = Record<string, unknown>>(
  extensionPointId: ExtensionPointId,
  context: ExtensionContext
): {
  extensions: RegisteredExtension<T>[];
  ExtensionComponents: Array<{ id: string; component: React.ComponentType<T>; pluginId: string }>;
} {
  if (typeof window === 'undefined') {
    return { extensions: [], ExtensionComponents: [] };
  }
  return {
    extensions: extensionRegistry.getExtensions<T>(extensionPointId, context),
    ExtensionComponents: extensionRegistry.getExtensionComponents<T>(extensionPointId, context),
  };
}

export function getExtensions<T = Record<string, unknown>>(
  extensionPointId: ExtensionPointId,
  context: ExtensionContext
): RegisteredExtension<T>[] {
  return extensionRegistry.getExtensions<T>(extensionPointId, context);
}

export function getExtensionComponents<T = Record<string, unknown>>(
  extensionPointId: ExtensionPointId,
  context: ExtensionContext
): Array<{ id: string; component: React.ComponentType<T>; pluginId: string }> {
  return extensionRegistry.getExtensionComponents<T>(extensionPointId, context);
}

export function getAllPlugins(): PluginManifest[] {
  return extensionRegistry.getAllPlugins();
}

export function hasPlugin(pluginId: string): boolean {
  return extensionRegistry.hasPlugin(pluginId);
}
