import {
  compareVersions,
  evaluateAppUpdatePrompt,
  shouldShowOptionalPrompt,
} from '@/features/appUpdate/services/appUpdatePolicy';
import {Platform} from 'react-native';

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

describe('appUpdatePolicy', () => {
  beforeEach(() => {
    (Platform as {OS: string}).OS = 'android';
  });

  it('compares semantic versions correctly', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('1.2.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0', '1.9.9')).toBe(1);
  });

  it('returns required prompt when below minimum supported version', () => {
    const prompt = evaluateAppUpdatePrompt(
      {
        env: 'production',
        enablePayments: true,
        appUpdate: {
          enabled: true,
          minimumSupportedVersion: '1.4.0',
          minimumSupportedBuildNumber: 220,
          latestVersion: '1.6.0',
          androidStoreUrl:
            'https://play.google.com/store/apps/details?id=com.yc',
        },
      },
      '1.3.0',
      210,
      'com.yc',
    );

    expect(prompt?.kind).toBe('required');
    expect(prompt?.minimumSupportedVersion).toBe('1.4.0');
  });

  it('returns optional prompt when latest version is newer and app is still supported', () => {
    const prompt = evaluateAppUpdatePrompt(
      {
        env: 'production',
        enablePayments: true,
        appUpdate: {
          enabled: true,
          minimumSupportedVersion: '1.0.0',
          latestVersion: '1.6.0',
          remindAfterHours: 12,
          androidStoreUrl:
            'https://play.google.com/store/apps/details?id=com.yc',
        },
      },
      '1.5.0',
      300,
      'com.yc',
    );

    expect(prompt?.kind).toBe('optional');
    expect(prompt?.latestVersion).toBe('1.6.0');
    expect(prompt?.remindAfterHours).toBe(12);
  });

  it('prefers platform-specific android policy values over global values', () => {
    const prompt = evaluateAppUpdatePrompt(
      {
        env: 'production',
        enablePayments: true,
        appUpdate: {
          enabled: false,
          latestVersion: '1.6.0',
          android: {
            enabled: true,
            latestVersion: '1.7.0',
            remindAfterHours: 6,
            storeUrl:
              'https://play.google.com/store/apps/details?id=com.yc.android',
          },
        },
      },
      '1.6.0',
      500,
      'com.yc',
    );

    expect(prompt?.kind).toBe('optional');
    expect(prompt?.latestVersion).toBe('1.7.0');
    expect(prompt?.remindAfterHours).toBe(6);
    expect(prompt?.storeUrl).toBe(
      'https://play.google.com/store/apps/details?id=com.yc.android',
    );
  });

  it('does not return prompt when update config is missing', () => {
    const prompt = evaluateAppUpdatePrompt(
      {
        env: 'production',
        enablePayments: true,
      },
      '1.5.0',
      300,
      'com.yc',
    );

    expect(prompt).toBeNull();
  });

  it('honors remind-after interval for optional prompts', () => {
    const now = new Date('2026-03-23T10:00:00.000Z');

    expect(shouldShowOptionalPrompt(null, 24, now)).toBe(true);
    expect(shouldShowOptionalPrompt('2026-03-22T12:00:00.000Z', 24, now)).toBe(
      false,
    );
    expect(shouldShowOptionalPrompt('2026-03-22T09:00:00.000Z', 24, now)).toBe(
      true,
    );
  });

  it('falls back to market url on android when no store url is configured', () => {
    const prompt = evaluateAppUpdatePrompt(
      {
        env: 'production',
        enablePayments: true,
        appUpdate: {
          enabled: true,
          latestVersion: '2.0.0',
        },
      },
      '1.0.0',
      10,
      'com.yc.bundle',
    );

    expect(prompt?.storeUrl).toBe('market://details?id=com.yc.bundle');
  });

  it('downgrades forced update to optional when iOS store URL cannot be resolved', () => {
    (Platform as {OS: string}).OS = 'ios';

    const prompt = evaluateAppUpdatePrompt(
      {
        env: 'production',
        enablePayments: true,
        appUpdate: {
          enabled: true,
          force: true,
        },
      },
      '1.0.0',
      1,
      'com.yc.bundle',
    );

    expect(prompt?.kind).toBe('optional');
    expect(prompt?.storeUrl).toBeNull();
  });
});
