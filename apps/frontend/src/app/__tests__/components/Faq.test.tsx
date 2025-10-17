import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Faq from '@/app/components/Faq/Faq';

jest.mock('react-bootstrap', () => ({
  Container: jest.fn(({ children }) => <div data-testid="mock-container">{children}</div>),
}));

describe('Faq Component', () => {
  const items = [
    {
      id: "collapseOne",
      title: "What are the benefits of open-source in animal health?",
      content: "Open-source models encourage collaboration among researchers, veterinarians, and public health officials by providing a common platform for sharing data and insights.",
    },
    {
      id: "collapseTwo",
      title: "Is Open source model cost effective?",
      content: "Open-source solutions can be more affordable than proprietary software, making advanced tools and data management systems accessible to institutions in lower-income countries and to smaller organisations. ",
    },
    {
      id: "collapseThree",
      title: "How does Yosemite Crew ensure high data security and reliability?",
      content: "We provide ISO 27001 and SOC 2-compliant cloud hosting, daily automatic backups, unlimited cloud storage, and 24x7 support. Plus, the platform is designed to scale with your clinic while keeping all data encrypted and confidential, which many PMS providers cannot guarantee.",
    },
    {
      id: "collapseFour",
      title: "Is your system integrated with an AI scribe?",
      content: "Currently, our system does not include AI scribe integration. However, in our next launch, AI scribe integration will be introduced. Along with this, we’ll also be adding features like prescription alerts and PMS plugins—so stay tuned!",
    },
  ];

  it('should render the main heading and all accordion titles', () => {
    render(<Faq />);

    expect(screen.getByRole('heading', { name: /Frequently Asked Questions/i })).toBeInTheDocument();

    items.forEach(item => {
      expect(screen.getByRole('button', { name: item.title })).toBeInTheDocument();
    });
  });

  it('should have all accordion items collapsed by default', () => {
    render(<Faq />);

    items.forEach(item => {
      const content = document.getElementById(item.id);
      expect(content).not.toHaveClass('show');
      const button = screen.getByRole('button', { name: item.title });
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('should expand an accordion item when its button is clicked', async () => {
    const user = userEvent.setup();
    render(<Faq />);

    const firstItemButton = screen.getByRole('button', { name: items[0].title });
    const firstItemContent = document.getElementById(items[0].id);

    expect(firstItemButton).toHaveAttribute('aria-expanded', 'false');
    expect(firstItemContent).not.toHaveClass('show');

    await user.click(firstItemButton);

    expect(firstItemButton).toHaveAttribute('aria-expanded', 'true');
    expect(firstItemContent).toHaveClass('show');
  });

  it('should collapse an open accordion item when its button is clicked again', async () => {
    const user = userEvent.setup();
    render(<Faq />);

    const firstItemButton = screen.getByRole('button', { name: items[0].title });
    const firstItemContent = document.getElementById(items[0].id);

    await user.click(firstItemButton);
    expect(firstItemButton).toHaveAttribute('aria-expanded', 'true');
    expect(firstItemContent).toHaveClass('show');

    await user.click(firstItemButton);
    expect(firstItemButton).toHaveAttribute('aria-expanded', 'false');
    expect(firstItemContent).not.toHaveClass('show');
  });

  it('should collapse the previously open item when a new one is clicked', async () => {
    const user = userEvent.setup();
    render(<Faq />);

    const firstItemButton = screen.getByRole('button', { name: items[0].title });
    const secondItemButton = screen.getByRole('button', { name: items[1].title });
    const firstItemContent = document.getElementById(items[0].id);
    const secondItemContent = document.getElementById(items[1].id);

    await user.click(firstItemButton);
    expect(firstItemButton).toHaveAttribute('aria-expanded', 'true');
    expect(firstItemContent).toHaveClass('show');
    expect(secondItemButton).toHaveAttribute('aria-expanded', 'false');
    expect(secondItemContent).not.toHaveClass('show');

    await user.click(secondItemButton);

    expect(firstItemButton).toHaveAttribute('aria-expanded', 'false');
    expect(firstItemContent).not.toHaveClass('show');
    expect(secondItemButton).toHaveAttribute('aria-expanded', 'true');
    expect(secondItemContent).toHaveClass('show');
  });
});

