import { render, screen } from '@testing-library/react';
import { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import Documents from '@/app/features/companions/components/Sections/Documents';

jest.mock('@/app/features/documents/components/CompanionDocumentsSection', () => ({
  __esModule: true,
  default: ({ companionId }: { companionId: string }) => (
    <div data-testid="companion-documents">{companionId}</div>
  ),
}));

const makeCompanionParent = (companionId: string): CompanionParent =>
  ({ companion: { id: companionId } }) as unknown as CompanionParent;

describe('Companions Sections Documents', () => {
  it('passes the companion id to the documents section', () => {
    render(<Documents companion={makeCompanionParent('companion-7')} />);
    expect(screen.getByTestId('companion-documents')).toHaveTextContent('companion-7');
  });

  it('follows the companion id when it changes', () => {
    const { rerender } = render(<Documents companion={makeCompanionParent('companion-1')} />);
    rerender(<Documents companion={makeCompanionParent('companion-2')} />);
    expect(screen.getByTestId('companion-documents')).toHaveTextContent('companion-2');
  });
});
