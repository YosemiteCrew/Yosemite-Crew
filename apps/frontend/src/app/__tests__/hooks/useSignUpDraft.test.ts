import { renderHook, act } from '@testing-library/react';
import { useSignUpDraft } from '@/app/hooks/useSignUpDraft';

const STORAGE_KEY = 'yc_signup_draft';

describe('useSignUpDraft', () => {
  const setFirstName = jest.fn();
  const setLastName = jest.fn();
  const setEmail = jest.fn();

  const defaultOptions = () => ({
    firstName: '',
    lastName: '',
    email: '',
    setFirstName,
    setLastName,
    setEmail,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  it('restores saved draft into state setters on mount', () => {
    const draft = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      expiresAt: Date.now() + 60_000,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));

    renderHook(() => useSignUpDraft(defaultOptions()));

    expect(setFirstName).toHaveBeenCalledWith('Jane');
    expect(setLastName).toHaveBeenCalledWith('Doe');
    expect(setEmail).toHaveBeenCalledWith('jane@example.com');
  });

  it('does not restore an expired draft', () => {
    const draft = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      expiresAt: Date.now() - 1,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));

    renderHook(() => useSignUpDraft(defaultOptions()));

    expect(setFirstName).not.toHaveBeenCalled();
    expect(setLastName).not.toHaveBeenCalled();
    expect(setEmail).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does not restore when no draft exists', () => {
    renderHook(() => useSignUpDraft(defaultOptions()));

    expect(setFirstName).not.toHaveBeenCalled();
    expect(setLastName).not.toHaveBeenCalled();
    expect(setEmail).not.toHaveBeenCalled();
  });

  it('persists non-sensitive fields to sessionStorage when they change', () => {
    const { rerender } = renderHook((opts) => useSignUpDraft(opts), {
      initialProps: defaultOptions(),
    });

    act(() => {
      rerender({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        setFirstName,
        setLastName,
        setEmail,
      });
    });

    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    expect(stored).not.toBeNull();
    expect(stored.firstName).toBe('Jane');
    expect(stored.lastName).toBe('Doe');
    expect(stored.email).toBe('jane@example.com');
    expect(stored.expiresAt).toBeGreaterThan(Date.now());
  });

  it('clears the draft when clearSignUpDraft is called', () => {
    const draft = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      expiresAt: Date.now() + 60_000,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));

    const { result } = renderHook(() => useSignUpDraft(defaultOptions()));

    act(() => {
      result.current.clearSignUpDraft();
    });

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does not persist when all fields are empty strings', () => {
    renderHook(() => useSignUpDraft(defaultOptions()));
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clears a previously saved draft when all fields are emptied', () => {
    const { rerender } = renderHook((opts) => useSignUpDraft(opts), {
      initialProps: {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        setFirstName,
        setLastName,
        setEmail,
      },
    });

    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();

    act(() => {
      rerender(defaultOptions());
    });

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
