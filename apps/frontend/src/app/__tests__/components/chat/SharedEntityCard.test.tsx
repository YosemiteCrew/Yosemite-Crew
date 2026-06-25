import { render, screen } from '@testing-library/react';
import {
  SharedEntityCard,
  type SharedEntityData,
} from '@/app/features/chat/components/SharedEntityCard';

// Terminology hook returns the input unchanged so "Companion record" stays as-is.
jest.mock('@/app/hooks/useCompanionTerminologyText', () => ({
  useCompanionTerminologyText: () => (s: string) => s,
}));

const makeEntity = (over: Partial<SharedEntityData> = {}): SharedEntityData => ({
  entityType: 'COMPANION',
  entityId: 'ent-1',
  ...over,
});

describe('SharedEntityCard', () => {
  it('renders the COMPANION label (terminology applied, unchanged here)', () => {
    render(<SharedEntityCard entity={makeEntity({ entityType: 'COMPANION' })} />);
    expect(screen.getAllByText('Companion record').length).toBeGreaterThan(0);
  });

  it.each([
    ['APPOINTMENT', 'Appointment'],
    ['INVOICE', 'Invoice'],
    ['FORM', 'Form'],
    ['PRESCRIPTION', 'Prescription'],
    ['DOCUMENT', 'Document'],
  ])('renders the %s label', (entityType, label) => {
    render(<SharedEntityCard entity={makeEntity({ entityType })} />);
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it('falls back to "Shared item" for an unknown entity type', () => {
    render(<SharedEntityCard entity={makeEntity({ entityType: 'MYSTERY' })} />);
    expect(screen.getAllByText('Shared item').length).toBeGreaterThan(0);
  });

  it('renders the title when provided', () => {
    render(
      <SharedEntityCard entity={makeEntity({ entityType: 'INVOICE', title: 'Invoice #42' })} />
    );
    expect(screen.getByText('Invoice #42')).toBeInTheDocument();
  });

  it('falls back to the label as the title when title is absent', () => {
    render(<SharedEntityCard entity={makeEntity({ entityType: 'INVOICE', title: null })} />);
    // Label appears both as the uppercase eyebrow and as the title fallback.
    expect(screen.getAllByText('Invoice')).toHaveLength(2);
  });

  it('renders the subtitle when snapshot.subtitle is a string', () => {
    render(
      <SharedEntityCard
        entity={makeEntity({
          entityType: 'APPOINTMENT',
          title: 'Checkup',
          snapshot: { subtitle: 'Tomorrow 3pm' },
        })}
      />
    );
    expect(screen.getByText('Tomorrow 3pm')).toBeInTheDocument();
  });

  it('omits the subtitle when snapshot.subtitle is missing or not a string', () => {
    render(
      <SharedEntityCard
        entity={makeEntity({
          entityType: 'APPOINTMENT',
          title: 'Checkup',
          snapshot: { subtitle: 42 },
        })}
      />
    );
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });

  it('omits the subtitle when snapshot is null', () => {
    const { container } = render(
      <SharedEntityCard
        entity={makeEntity({ entityType: 'FORM', title: 'Intake', snapshot: null })}
      />
    );
    // Only label eyebrow + title text spans, no subtitle span.
    expect(screen.getByText('Intake')).toBeInTheDocument();
    expect(container).toBeTruthy();
  });

  it('applies the "mine" border styling when mine is true', () => {
    const { container } = render(<SharedEntityCard entity={makeEntity()} mine />);
    expect(container.querySelector('.border-primary-300')).toBeInTheDocument();
  });

  it('applies the default (not mine) border styling when mine is false', () => {
    const { container } = render(<SharedEntityCard entity={makeEntity()} mine={false} />);
    expect(container.querySelector('.border-chat-divider')).toBeInTheDocument();
    expect(container.querySelector('.border-primary-300')).not.toBeInTheDocument();
  });

  it('renders an icon glyph for the entity', () => {
    const { container } = render(<SharedEntityCard entity={makeEntity()} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
