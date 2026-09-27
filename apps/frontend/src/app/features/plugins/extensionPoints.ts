/**
 * The places in the PIMS where an installed plugin may add something. A plugin
 * names one of these ids; anything else is ignored, so a plugin can never place
 * content somewhere the PIMS did not declare.
 */
export const EXTENSION_POINTS = {
  'appointment.workspace.panel': { kind: 'panel', label: 'Appointment workspace' },
  'appointment.workspace.action': { kind: 'action', label: 'Appointment workspace' },
  'forms.configuration.panel': { kind: 'panel', label: 'Form configuration' },
  'forms.configuration.action': { kind: 'action', label: 'Form configuration' },
} as const;

export type ExtensionPointId = keyof typeof EXTENSION_POINTS;

export type PluginContribution = {
  pluginId: string;
  pluginName: string;
  point: string;
  title: string;
  url: string;
};

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

/** The contributions that belong at `point`, dropping any whose URL is not https. */
export const contributionsFor = (
  point: ExtensionPointId,
  contributions: readonly PluginContribution[]
): PluginContribution[] => contributions.filter((c) => c.point === point && isHttpsUrl(c.url));
