import React from 'react';
import { render, screen } from '@testing-library/react';
import AddTask from '@/app/features/companions/components/Sections/AddTask';

// --- Mocks ---

// Mock the Accordion to verify props passed to it
jest.mock('@/app/ui/primitives/Accordion/Accordion', () => {
  return function MockAccordion(props: any) {
    return (
      <div data-testid="accordion-mock">
        <span data-testid="accordion-title">{props.title}</span>
        <span data-testid="accordion-default-open">{props.defaultOpen ? 'true' : 'false'}</span>
        <span data-testid="accordion-show-edit">{props.showEditIcon ? 'true' : 'false'}</span>
      </div>
    );
  };
});

describe('AddTask Component', () => {
  // --- 1. Rendering Structure ---

  it('renders the main page title', () => {
    render(<AddTask />);
    // The panel title names the panel and its section names the section; they
    // used to be the same words, so the drawer read "Add task" twice.
    expect(screen.getByRole('heading', { name: 'New task' })).toBeInTheDocument();
    expect(screen.queryByText('Add task')).not.toBeInTheDocument();
  });

  it('renders the Accordion component', () => {
    render(<AddTask />);
    expect(screen.getByTestId('accordion-mock')).toBeInTheDocument();
  });

  // --- 2. Props Integration ---

  it('passes correct props to the Accordion', () => {
    render(<AddTask />);

    // Verify Title Prop
    expect(screen.getByTestId('accordion-title')).toHaveTextContent('Task details');

    // Verify defaultOpen Prop (should be true)
    expect(screen.getByTestId('accordion-default-open')).toHaveTextContent('true');

    // Verify showEditIcon Prop (should be false)
    expect(screen.getByTestId('accordion-show-edit')).toHaveTextContent('false');
  });
});
