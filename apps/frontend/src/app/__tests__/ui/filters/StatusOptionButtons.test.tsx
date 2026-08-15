import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatusOptionButtons from '@/app/ui/filters/StatusOptionButtons';

type Option = { key: string; name: string; border?: string; text?: string };

const options: Option[] = [
  { key: 'all', name: 'All', border: 'var(--all-border)', text: 'var(--all-text)' },
  { key: 'done', name: 'Done', border: 'var(--done-border)', text: 'var(--done-text)' },
  { key: 'bare', name: 'Bare' },
];

const getTextColor = (option: Option) => option.text ?? 'var(--fallback-text)';

const renderButtons = (activeKey?: string, onSelect = jest.fn()) => {
  render(
    <StatusOptionButtons
      options={options}
      activeKey={activeKey}
      allKey="all"
      onSelect={onSelect}
      getTextColor={getTextColor}
    />
  );
  return onSelect;
};

describe('StatusOptionButtons', () => {
  it('renders one button per option with a dot only for options that carry a border token', () => {
    renderButtons('done');
    expect(screen.getAllByRole('button')).toHaveLength(3);

    const done = screen.getByRole('button', { name: /Done/ });
    const dot = done.querySelector('span.size-2');
    expect(dot).toHaveStyle({
      backgroundColor: 'var(--done-border)',
      borderColor: 'var(--done-border)',
    });

    const bare = screen.getByRole('button', { name: 'Bare' });
    expect(bare.querySelector('span.size-2')).toBeNull();
  });

  it('marks the active non-all option with the active weight and a check', () => {
    renderButtons('done');
    const done = screen.getByRole('button', { name: /Done/ });
    expect(done).toHaveClass('font-medium');
    expect(done).toHaveTextContent('✓');

    const bare = screen.getByRole('button', { name: 'Bare' });
    expect(bare).toHaveClass('hover:bg-card-hover');
    expect(bare).not.toHaveTextContent('✓');
  });

  it('keeps the neutral hover treatment for the active all option while still showing its check', () => {
    renderButtons('all');
    const all = screen.getByRole('button', { name: /All/ });
    expect(all).not.toHaveClass('font-medium');
    expect(all).toHaveClass('hover:bg-card-hover');
    expect(all).toHaveTextContent('✓');
  });

  it('renders no check when no option is active', () => {
    renderButtons(undefined);
    expect(screen.queryByText('✓')).not.toBeInTheDocument();
  });

  it('colours the name and check with getTextColor and reports the selected key', () => {
    const onSelect = renderButtons('done');
    expect(screen.getByText('Done')).toHaveStyle({ color: 'var(--done-text)' });
    expect(screen.getByText('Bare')).toHaveStyle({ color: 'var(--fallback-text)' });

    fireEvent.click(screen.getByRole('button', { name: 'Bare' }));
    expect(onSelect).toHaveBeenCalledWith('bare');
  });
});
