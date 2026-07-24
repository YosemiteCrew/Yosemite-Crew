import {
  BUILTIN_SOAP_TEMPLATES,
  buildSoapTemplateOptions,
  findSoapPreset,
  isSoapPresetId,
} from '@/app/features/appointments/lib/soapTemplatePresets';
import type { SoapTemplate } from '@/app/features/appointments/types/workspace';

describe('soapTemplatePresets', () => {
  it('ships four built-in clinical presets with S/O/A/P content', () => {
    expect(BUILTIN_SOAP_TEMPLATES.map((preset) => preset.name)).toEqual([
      'Wellness',
      'Sick visit',
      'Recheck',
      'Dental',
    ]);
    BUILTIN_SOAP_TEMPLATES.forEach((preset) => {
      expect(preset.content.subjective).toContain('<p>');
      expect(preset.content.plan).toContain('<p>');
    });
  });

  it('maps real SOAP templates to chip options with a clinic-default subtitle', () => {
    const templates: SoapTemplate[] = [
      { id: 'a', name: 'Annual wellness', isDefault: true },
      { id: 'b', name: 'Dermatology' },
    ];
    const { options, isBuiltin } = buildSoapTemplateOptions(templates);
    expect(isBuiltin).toBe(false);
    expect(options).toEqual([
      { id: 'a', name: 'Annual wellness', subtitle: 'Clinic default' },
      { id: 'b', name: 'Dermatology', subtitle: undefined },
    ]);
  });

  it('falls back to the built-in presets when the org has no templates', () => {
    const { options, isBuiltin } = buildSoapTemplateOptions([]);
    expect(isBuiltin).toBe(true);
    expect(options).toHaveLength(4);
    expect(options[0]).toEqual({
      id: 'builtin-wellness',
      name: 'Wellness',
      subtitle: 'Built-in · 4 sections',
    });
  });

  it('resolves a preset by id and recognises preset ids', () => {
    expect(findSoapPreset('builtin-dental')?.name).toBe('Dental');
    expect(findSoapPreset('nope')).toBeUndefined();
    expect(isSoapPresetId('builtin-recheck')).toBe(true);
    expect(isSoapPresetId('real-template-id')).toBe(false);
  });
});
