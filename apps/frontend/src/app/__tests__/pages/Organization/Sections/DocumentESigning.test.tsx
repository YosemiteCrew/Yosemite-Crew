import React from 'react';
import { render, screen } from '@testing-library/react';
import DocumentESigning from '@/app/features/organization/pages/Organization/Sections/DocumentESigning';

jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children, allOf }: any) => (
    <div data-testid="permission-gate" data-allof={JSON.stringify(allOf)}>
      {children}
    </div>
  ),
}));

jest.mock('@/app/ui/primitives/Accordion/AccordionButton', () => ({
  __esModule: true,
  default: ({ title, showButton, keepMounted, children }: any) => (
    <div
      data-testid="accordion-button"
      data-title={title}
      data-show-button={String(showButton)}
      data-keep-mounted={String(keepMounted)}
    >
      {children}
    </div>
  ),
}));

jest.mock('@/app/features/docSigning/components/DocSigningPortal', () => ({
  __esModule: true,
  default: ({ embedded }: any) => (
    <div data-testid="doc-signing-portal" data-embedded={String(embedded)} />
  ),
}));

describe('DocumentESigning', () => {
  it('gates the section behind the document:view:any permission', () => {
    render(<DocumentESigning />);
    const gate = screen.getByTestId('permission-gate');
    expect(gate).toHaveAttribute('data-allof', JSON.stringify(['document:view:any']));
  });

  it('renders the accordion with the expected title and non-collapsible config', () => {
    render(<DocumentESigning />);
    const accordion = screen.getByTestId('accordion-button');
    expect(accordion).toHaveAttribute('data-title', 'Document e-signing');
    expect(accordion).toHaveAttribute('data-show-button', 'false');
    expect(accordion).toHaveAttribute('data-keep-mounted', 'true');
  });

  it('renders the embedded doc signing portal', () => {
    render(<DocumentESigning />);
    const portal = screen.getByTestId('doc-signing-portal');
    expect(portal).toHaveAttribute('data-embedded', 'true');
  });
});
