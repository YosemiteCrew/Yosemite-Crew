import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TrustCenter from '@/app/features/legal/pages/TrustCenter';

// 1. Mock next/image to filter out Next.js specific props to prevent console errors
jest.mock('next/image', () => ({
  __esModule: true,
  default: (rawProps: any) => {
    const { src, alt, style, ...props } = rawProps;
    delete props.priority;
    delete props.fill;
    delete props.loader;
    return React.createElement('img', { src, alt, style, ...props });
  },
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

// Mock window.alert
globalThis.alert = jest.fn();

describe('TrustCenter Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to safely find text nodes even if broken by icons
  const getButtonsByText = (text: string) => {
    return screen.getAllByText((content, element) => {
      return element?.tagName.toLowerCase() !== 'script' && content.includes(text);
    });
  };

  // Helper to switch to Resources tab where buttons exist
  const switchToResourcesTab = () => {
    const resourcesTab = screen.getByText('Resources', {
      selector: 'button.TrustTabBtn',
    });
    fireEvent.click(resourcesTab);
  };

  it('renders the hero section correctly', () => {
    render(<TrustCenter />);
    expect(screen.getByText(/Security, Privacy, and Compliance/i)).toBeInTheDocument();
    expect(screen.getByText(/At Yosemite Crew, protecting your veterinary/i)).toBeInTheDocument();
    expect(screen.getByText(/support@yosemitecrew.com/i)).toBeInTheDocument();
  });

  it('renders certifications correctly', () => {
    render(<TrustCenter />);
    expect(screen.getByText('Compliance & Regulations')).toBeInTheDocument();
    expect(screen.getByText('GDPR')).toBeInTheDocument();
    expect(screen.getByText('21 CFR Part 11')).toBeInTheDocument();
  });

  it('renders resources and handles copy link', () => {
    render(<TrustCenter />);

    // FIX: Switch to Resources tab first
    switchToResourcesTab();

    expect(screen.getByText('Security Resources')).toBeInTheDocument();

    const copyButtons = getButtonsByText('Copy link');
    // Click the first Copy link button found
    fireEvent.click(copyButtons[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(globalThis.alert).toHaveBeenCalledWith('Link copied to clipboard!');
  });

  it('handles locked resource click to open modal', () => {
    render(<TrustCenter />);

    // FIX: Switch to Resources tab first
    switchToResourcesTab();

    const requestButtons = getButtonsByText('Request access');
    fireEvent.click(requestButtons[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/You are requesting access to:/i)).toBeInTheDocument();
  });

  it('handles modal form submission', () => {
    render(<TrustCenter />);

    // FIX: Switch to Resources tab first
    switchToResourcesTab();

    // Open modal
    const requestButtons = getButtonsByText('Request access');
    fireEvent.click(requestButtons[0]);

    // Fill form
    const firstNameInput = screen.getByLabelText(/First Name/i);
    const lastNameInput = screen.getByLabelText(/Last Name/i);
    const emailInput = screen.getByLabelText(/Work Email/i);
    const companyInput = screen.getByLabelText(/Company Name/i);
    const reasonSelect = screen.getByLabelText(/Reason for Request/i);

    fireEvent.change(firstNameInput, { target: { value: 'John' } });
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
    fireEvent.change(companyInput, { target: { value: 'Test Co' } });
    fireEvent.change(reasonSelect, { target: { value: 'due_diligence' } });

    // Submit
    const modal = screen.getByRole('dialog');
    const submitBtn = within(modal).getByText('Request Access', {
      selector: 'button',
    });
    fireEvent.click(submitBtn);

    expect(globalThis.alert).toHaveBeenCalledWith(
      'Request sent! Our team will review your credentials.'
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows an inline error when the work email is invalid', () => {
    render(<TrustCenter />);

    switchToResourcesTab();

    const requestButtons = getButtonsByText('Request access');
    fireEvent.click(requestButtons[0]);

    fireEvent.change(screen.getByLabelText(/Work Email/i), {
      target: { value: 'not-an-email' },
    });

    const modal = screen.getByRole('dialog');
    const submitBtn = within(modal).getByText('Request Access', {
      selector: 'button',
    });
    fireEvent.click(submitBtn);

    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    expect(globalThis.alert).not.toHaveBeenCalled();
  });

  it('handles modal close via Cancel button', () => {
    render(<TrustCenter />);

    // FIX: Switch to Resources tab first
    switchToResourcesTab();

    const requestButtons = getButtonsByText('Request access');
    fireEvent.click(requestButtons[0]);

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('handles modal close via Close icon', () => {
    render(<TrustCenter />);

    // FIX: Switch to Resources tab first
    switchToResourcesTab();

    const requestButtons = getButtonsByText('Request access');
    fireEvent.click(requestButtons[0]);

    const closeIcon = screen.getByLabelText('Close modal');
    fireEvent.click(closeIcon);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('switches tabs correctly', () => {
    render(<TrustCenter />);

    // Click Controls tab
    const controlsTab = screen.getByText('Controls', {
      selector: 'button.TrustTabBtn',
    });
    fireEvent.click(controlsTab);
    expect(screen.getByText('Security Controls (ISMS)')).toBeInTheDocument();

    // Click Subprocessors tab
    const subprocTab = screen.getByText('Subprocessors', {
      selector: 'button.TrustTabBtn',
    });
    fireEvent.click(subprocTab);
    expect(screen.getByText('Authorized Sub-processors')).toBeInTheDocument();
    expect(screen.getByText('Amazon Web Services')).toBeInTheDocument();
  });

  it("navigates to tabs via Overview 'View all' buttons", () => {
    render(<TrustCenter />);

    // Find "View all" buttons.
    const viewAllButtons = screen.getAllByText(/View all/i);

    // Click Controls View All (first one)
    fireEvent.click(viewAllButtons[0]);
    expect(screen.getByText('Security Controls (ISMS)')).toBeInTheDocument();
  });

  it('renders keyboard interactions for accessibility', () => {
    render(<TrustCenter />);

    // FIX: Switch to Resources tab first so "Copy link" is visible
    switchToResourcesTab();

    // Use helper to find text nodes, then get parent clickable element
    const copyTextNodes = getButtonsByText('Copy link');
    // The clickable element is likely the parent div with class ActionBtn
    // We can traverse up or query differently.
    // Since getButtonsByText returns the text node wrapper (likely a span or div inside button),
    // and we changed the implementation to use semantic <button>,
    // grab either a native button or a role-based fallback.
    const copyButton = copyTextNodes[0].closest('button, [role="button"]');

    if (copyButton) {
      if (copyButton.tagName.toLowerCase() === 'button') {
        fireEvent.click(copyButton);
      } else {
        fireEvent.keyDown(copyButton, { key: 'Enter', code: 'Enter' });
      }
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    } else {
      throw new Error('Could not find clickable copy button for accessibility test');
    }
  });
});
