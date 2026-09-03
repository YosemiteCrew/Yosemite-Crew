import React from 'react';
import type {ReactTestInstance} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import {render} from '@testing-library/react-native';
// Path: 3 levels up to __tests__, then into setup (also remapped by jest config).
import {mockTheme} from '../../../setup/mockTheme';
import {ModelStatusBanner} from '@/features/assistant/components/ModelStatusBanner/ModelStatusBanner';
import type {OnDeviceModelAvailability} from '@/features/assistant/types';

/**
 * The real English catalogue for `assistant.model.*`, copied verbatim from
 * src/localization/resources/en/common.json. Using the shipping copy (rather
 * than placeholder text) means an assertion on the rendered sentence pins both
 * the key the component chose AND the value it interpolated into it.
 *
 * `unknown` deliberately carries no {{provider}} placeholder — that is how the
 * catalogue is written, and the component must still render it.
 */
const COPY: Record<string, string> = {
  'assistant.model.provider': 'on-device AI',
  'assistant.model.unsupportedOS':
    "Answers here are exact rather than chatty. {{provider}} needs a newer version of this phone's software.",
  'assistant.model.unsupportedDevice':
    'Answers here are exact rather than chatty. This device does not support {{provider}}.',
  'assistant.model.notEnabled':
    'Turn on {{provider}} in system settings for more natural replies. Everything still works without it.',
  'assistant.model.modelNotReady':
    '{{provider}} is still downloading. Replies stay exact until it is ready.',
  'assistant.model.unknown':
    'Replies are exact rather than chatty on this device.',
};

/**
 * A t() that interpolates for real. A key the catalogue does not carry comes
 * back as the raw key, so a component that built the wrong key would render
 * something visibly different from any real sentence.
 */
const mockT = jest.fn((key: string, options?: {provider?: string}): string => {
  const template = COPY[key];
  if (template === undefined) {
    return key;
  }
  return template.replace('{{provider}}', options?.provider ?? '');
});

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: mockT}),
}));

const renderBanner = (availability: OnDeviceModelAvailability) =>
  render(<ModelStatusBanner availability={availability} />);

/** The one Text node inside the banner, or null when nothing rendered. */
const bannerTextNode = (
  utils: ReturnType<typeof renderBanner>,
): ReactTestInstance | null => {
  const banner = utils.queryByTestId('assistant-model-status');
  if (banner === null) {
    return null;
  }
  const children = banner.children.filter(
    (child): child is ReactTestInstance => typeof child !== 'string',
  );
  expect(children).toHaveLength(1);
  return children[0];
};

/** The single line of copy inside the banner, or null when nothing rendered. */
const bannerText = (utils: ReturnType<typeof renderBanner>): string | null => {
  const node = bannerTextNode(utils);
  return node === null ? null : (node.props.children as string);
};

beforeEach(() => {
  mockT.mockClear();
});

describe('ModelStatusBanner', () => {
  describe('when the on-device model is available', () => {
    it('renders nothing at all', () => {
      const utils = renderBanner({available: true});

      expect(utils.toJSON()).toBeNull();
    });

    it('does not translate anything, so no copy can leak into the tree', () => {
      renderBanner({available: true});

      expect(mockT).not.toHaveBeenCalled();
    });

    it('stays silent even when a reason and provider label are also present', () => {
      const utils = renderBanner({
        available: true,
        reason: 'notEnabled',
        providerLabel: 'Apple Intelligence',
      });

      expect(utils.queryByTestId('assistant-model-status')).toBeNull();
      expect(
        utils.queryByText(
          'Turn on Apple Intelligence in system settings for more natural replies. Everything still works without it.',
        ),
      ).toBeNull();
    });
  });

  describe('when the on-device model is unavailable', () => {
    it('renders the banner under the assistant-model-status test id', () => {
      const utils = renderBanner({
        available: false,
        reason: 'notEnabled',
        providerLabel: 'Apple Intelligence',
      });

      expect(utils.queryByTestId('assistant-model-status')).not.toBeNull();
    });

    it('shows the sentence for the reason with the provider name filled in', () => {
      const utils = renderBanner({
        available: false,
        reason: 'notEnabled',
        providerLabel: 'Apple Intelligence',
      });

      expect(bannerText(utils)).toBe(
        'Turn on Apple Intelligence in system settings for more natural replies. Everything still works without it.',
      );
    });
  });

  describe('the translation key follows the reason', () => {
    const reasons: ReadonlyArray<
      [NonNullable<OnDeviceModelAvailability['reason']>, string]
    > = [
      [
        'unsupportedOS',
        "Answers here are exact rather than chatty. Apple Intelligence needs a newer version of this phone's software.",
      ],
      [
        'unsupportedDevice',
        'Answers here are exact rather than chatty. This device does not support Apple Intelligence.',
      ],
      [
        'notEnabled',
        'Turn on Apple Intelligence in system settings for more natural replies. Everything still works without it.',
      ],
      [
        'modelNotReady',
        'Apple Intelligence is still downloading. Replies stay exact until it is ready.',
      ],
      ['unknown', 'Replies are exact rather than chatty on this device.'],
    ];

    it.each(reasons)(
      'asks for assistant.model.%s and renders its sentence',
      (reason, expectedText) => {
        const utils = renderBanner({
          available: false,
          reason,
          providerLabel: 'Apple Intelligence',
        });

        expect(mockT).toHaveBeenCalledWith(`assistant.model.${reason}`, {
          provider: 'Apple Intelligence',
        });
        expect(bannerText(utils)).toBe(expectedText);
      },
    );

    it('falls back to assistant.model.unknown when no reason is given', () => {
      const utils = renderBanner({
        available: false,
        providerLabel: 'Apple Intelligence',
      });

      expect(mockT).toHaveBeenCalledWith('assistant.model.unknown', {
        provider: 'Apple Intelligence',
      });
      expect(bannerText(utils)).toBe(
        'Replies are exact rather than chatty on this device.',
      );
    });

    it('renders the same copy for an absent reason as for an explicit unknown', () => {
      const implicit = renderBanner({available: false});
      const implicitText = bannerText(implicit);
      implicit.unmount();

      const explicit = renderBanner({available: false, reason: 'unknown'});

      expect(implicitText).toBe(
        'Replies are exact rather than chatty on this device.',
      );
      expect(bannerText(explicit)).toBe(implicitText);
    });
  });

  describe('the provider name', () => {
    it('uses the supplied provider label verbatim', () => {
      const utils = renderBanner({
        available: false,
        reason: 'modelNotReady',
        providerLabel: 'Gemini Nano',
      });

      expect(bannerText(utils)).toBe(
        'Gemini Nano is still downloading. Replies stay exact until it is ready.',
      );
    });

    it('does not look up the generic provider string when a label is supplied', () => {
      renderBanner({
        available: false,
        reason: 'modelNotReady',
        providerLabel: 'Gemini Nano',
      });

      expect(mockT).not.toHaveBeenCalledWith('assistant.model.provider');
      expect(mockT).toHaveBeenCalledTimes(1);
    });

    it('falls back to the generic provider string when no label is supplied', () => {
      const utils = renderBanner({
        available: false,
        reason: 'modelNotReady',
      });

      expect(bannerText(utils)).toBe(
        'on-device AI is still downloading. Replies stay exact until it is ready.',
      );
    });

    it('resolves the generic provider string before building the reason key', () => {
      renderBanner({available: false, reason: 'notEnabled'});

      expect(mockT.mock.calls).toEqual([
        ['assistant.model.provider'],
        ['assistant.model.notEnabled', {provider: 'on-device AI'}],
      ]);
    });

    it('interpolates the provider into every reason that carries the placeholder', () => {
      const utils = renderBanner({
        available: false,
        reason: 'unsupportedDevice',
        providerLabel: 'Apple Intelligence',
      });

      expect(bannerText(utils)).toBe(
        'Answers here are exact rather than chatty. This device does not support Apple Intelligence.',
      );
    });
  });

  describe('styling', () => {
    it('lays the banner out from the theme spacing and radius tokens', () => {
      const utils = renderBanner({available: false, reason: 'notEnabled'});

      const bannerStyle = StyleSheet.flatten(
        utils.getByTestId('assistant-model-status').props.style,
      );

      expect(bannerStyle).toMatchObject({
        marginHorizontal: 16,
        marginBottom: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 18,
      });
    });

    it('styles the copy with the small label typography and secondary text colour', () => {
      const utils = renderBanner({available: false, reason: 'unknown'});

      const node = bannerTextNode(utils);
      const textStyle = StyleSheet.flatten(node?.props.style);

      expect(textStyle).toMatchObject({
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 21,
        fontFamily: 'Satoshi-Medium',
        color: '#747473',
      });
    });
  });
});
