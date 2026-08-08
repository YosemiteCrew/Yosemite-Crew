import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AutosaveIndicator from '@/app/features/appointments/pages/AppointmentWorkspace/components/AutosaveIndicator';

describe('AutosaveIndicator', () => {
  it('renders nothing when idle', () => {
    const { container } = render(<AutosaveIndicator status="idle" />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('autosave-indicator')).not.toBeInTheDocument();
  });

  it('shows the saving state', () => {
    render(<AutosaveIndicator status="saving" />);
    const el = screen.getByTestId('autosave-indicator');
    expect(el).toHaveAttribute('data-state', 'saving');
    expect(el).toHaveTextContent('Saving');
  });

  it('shows the offline state', () => {
    render(<AutosaveIndicator status="offline" />);
    const el = screen.getByTestId('autosave-indicator');
    expect(el).toHaveAttribute('data-state', 'offline');
    expect(el).toHaveTextContent('Offline · retrying, edits kept locally');
  });

  it('shows the saved state with a stamped time', () => {
    render(<AutosaveIndicator status="saved" savedAt="2026-07-10T09:31:00.000Z" />);
    const el = screen.getByTestId('autosave-indicator');
    expect(el).toHaveAttribute('data-state', 'saved');
    expect(el).toHaveTextContent(/Autosaved/);
  });

  it('shows a bare "Autosaved" when no timestamp is supplied', () => {
    render(<AutosaveIndicator status="saved" />);
    expect(screen.getByTestId('autosave-indicator')).toHaveTextContent('Autosaved');
  });
});
