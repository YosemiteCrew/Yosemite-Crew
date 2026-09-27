import { createContext } from 'react';

import type { PluginContribution } from '@/app/features/plugins/extensionPoints';

const NO_CONTRIBUTIONS: readonly PluginContribution[] = [];

/** Supplies the contributions of the plugins the practice has installed. */
export const PluginContributionsContext =
  createContext<readonly PluginContribution[]>(NO_CONTRIBUTIONS);
