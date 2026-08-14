import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Icon, { Icon as NamedIcon } from '@/app/ui/icons/Icon';
import { OFFLINE_ICONS } from '@/app/ui/icons/offlineIcons';

// Every component suite mocks this wrapper, so nothing else exercises the
// resolver itself. Capture what it hands to Iconify instead of asserting on
// rendered SVG: the contract is "a bundled name becomes icon data, and anything
// else is passed through untouched", and that is exactly what decides whether a
// render costs a request to api.iconify.design.
const iconifyProps = jest.fn();

jest.mock('@iconify/react', () => ({
  __esModule: true,
  Icon: (props: Record<string, unknown>) => {
    iconifyProps(props);
    return <span data-testid="iconify" />;
  },
}));

describe('Icon', () => {
  beforeEach(() => {
    iconifyProps.mockClear();
  });

  const lastProps = () => iconifyProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;

  it('resolves a bundled name to its icon data rather than passing the string on', () => {
    render(<Icon icon="ion:paw-outline" />);

    // A string would make Iconify fetch it; the CSP no longer allows that host.
    expect(lastProps().icon).toEqual(OFFLINE_ICONS['ion:paw-outline']);
    expect(typeof lastProps().icon).toBe('object');
  });

  it('passes an unbundled name through unchanged', () => {
    render(<Icon icon="ion:not-bundled-anywhere" />);

    expect(lastProps().icon).toBe('ion:not-bundled-anywhere');
  });

  it('passes non-string icon data through untouched', () => {
    const inline = { body: '<path d="M0 0h24v24H0z"/>', width: 24, height: 24 };

    render(<Icon icon={inline} />);

    expect(lastProps().icon).toBe(inline);
  });

  it('forwards the remaining props to Iconify', () => {
    render(<Icon icon="ion:add" width={32} height={32} className="tile-icon" aria-hidden />);

    expect(lastProps()).toMatchObject({
      width: 32,
      height: 32,
      className: 'tile-icon',
      'aria-hidden': true,
    });
    expect(screen.getByTestId('iconify')).toBeInTheDocument();
  });

  it('exports the same component as both the default and the named export', () => {
    expect(NamedIcon).toBe(Icon);
  });
});
