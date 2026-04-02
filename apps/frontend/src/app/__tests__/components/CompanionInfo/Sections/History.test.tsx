import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import History from '@/app/features/companions/components/Sections/History';

const timelineSpy = jest.fn();

jest.mock('@/app/features/companionHistory/components/CompanionHistoryTimeline', () => ({
  __esModule: true,
  default: (props: any) => {
    timelineSpy(props);
    return <div data-testid="companion-history" />;
  },
}));

describe('Companion section History', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders timeline with upload enabled and companions return href', () => {
    render(<History companion={{ companion: { id: 'comp-7' } } as any} />);

    const props = timelineSpy.mock.calls[0][0];
    expect(props.companionId).toBe('comp-7');
    expect(props.showDocumentUpload).toBe(true);
    expect(props.compact).toBe(true);
    expect(props.fullPageHref).toContain('/companions/history?');
    expect(props.fullPageHref).toContain('source=companions');
    expect(props.fullPageHref).toContain('companionId=comp-7');
  });
});
