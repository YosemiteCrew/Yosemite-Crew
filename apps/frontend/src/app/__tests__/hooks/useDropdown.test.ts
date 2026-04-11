import { renderHook, act } from '@testing-library/react';
import { useDropdown, useFilteredOptions } from '@/app/hooks/useDropdown';

describe('useDropdown', () => {
  it('starts closed with empty search query', () => {
    const { result } = renderHook(() => useDropdown());
    expect(result.current.open).toBe(false);
    expect(result.current.searchQuery).toBe('');
  });

  it('openDropdown sets open to true', () => {
    const { result } = renderHook(() => useDropdown());
    act(() => {
      result.current.openDropdown();
    });
    expect(result.current.open).toBe(true);
  });

  it('closeDropdown sets open to false and clears query', () => {
    const { result } = renderHook(() => useDropdown());
    act(() => {
      result.current.openDropdown();
      result.current.setSearchQuery('test');
    });
    act(() => {
      result.current.closeDropdown();
    });
    expect(result.current.open).toBe(false);
    expect(result.current.searchQuery).toBe('');
  });

  it('toggleDropdown opens when closed', () => {
    const { result } = renderHook(() => useDropdown());
    act(() => {
      result.current.toggleDropdown();
    });
    expect(result.current.open).toBe(true);
  });

  it('toggleDropdown closes and clears query when open', () => {
    const { result } = renderHook(() => useDropdown());
    act(() => {
      result.current.openDropdown();
      result.current.setSearchQuery('abc');
    });
    act(() => {
      result.current.toggleDropdown();
    });
    expect(result.current.open).toBe(false);
    expect(result.current.searchQuery).toBe('');
  });

  it('setSearchQuery updates search query', () => {
    const { result } = renderHook(() => useDropdown());
    act(() => {
      result.current.setSearchQuery('hello');
    });
    expect(result.current.searchQuery).toBe('hello');
  });

  it('calls onClose callback when clicking outside the dropdown element', () => {
    const onClose = jest.fn();
    const { result } = renderHook(() => useDropdown({ onClose }));

    // Create a real DOM node and attach it to the ref to simulate a mounted dropdown
    const div = document.createElement('div');
    document.body.appendChild(div);
    Object.defineProperty(result.current.dropdownRef, 'current', {
      writable: true,
      value: div,
    });

    // Click outside the div (on body, not inside div)
    const event = new MouseEvent('mousedown', { bubbles: true });
    document.body.dispatchEvent(event);

    expect(onClose).toHaveBeenCalled();
    document.body.removeChild(div);
  });

  it('exposes dropdownRef and inputRef', () => {
    const { result } = renderHook(() => useDropdown());
    expect(result.current.dropdownRef).toBeDefined();
    expect(result.current.inputRef).toBeDefined();
  });
});

describe('useFilteredOptions', () => {
  const options = [
    { value: 'dog', label: 'Dog' },
    { value: 'cat', label: 'Cat' },
    { value: 'rabbit', label: 'Rabbit' },
  ];

  it('returns all options when search query is empty', () => {
    const { result } = renderHook(() => useFilteredOptions(options, ''));
    expect(result.current).toHaveLength(3);
  });

  it('returns all options when search query is whitespace', () => {
    const { result } = renderHook(() => useFilteredOptions(options, '   '));
    expect(result.current).toHaveLength(3);
  });

  it('filters options by label (case-insensitive)', () => {
    const { result } = renderHook(() => useFilteredOptions(options, 'cat'));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].value).toBe('cat');
  });

  it('filters options with uppercase search', () => {
    const { result } = renderHook(() => useFilteredOptions(options, 'DOG'));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].value).toBe('dog');
  });

  it('returns empty array when no match', () => {
    const { result } = renderHook(() => useFilteredOptions(options, 'xyz'));
    expect(result.current).toHaveLength(0);
  });

  it('returns partial matches', () => {
    const { result } = renderHook(() => useFilteredOptions(options, 'a'));
    // 'Cat' and 'Rabbit' both contain 'a'
    expect(result.current.length).toBeGreaterThanOrEqual(1);
  });
});
