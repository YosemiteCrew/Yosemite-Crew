import React from 'react';
import "@testing-library/jest-dom";

globalThis.HTMLElement.prototype.scrollIntoView = jest.fn();
// Polyfill for window.matchMedia
Object.defineProperty(globalThis, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

class IntersectionObserverMock {
  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn();
}

Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
});

Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
});

beforeAll(() => {
  window.scrollTo = jest.fn();
  // Silence noisy logs but keep them visible locally by toggling with an env flag if you want
  jest.spyOn(console, 'log').mockImplementation(() => {});

  // Turn unexpected warnings/errors into failures in CI
  jest.spyOn(console, 'warn').mockImplementation((...args) => {
    throw new Error('Unexpected console.warn: ' + args.join(' '));
  });
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    throw new Error('Unexpected console.error: ' + args.join(' '));
  });
});

afterAll(() => {
  (console.log as jest.Mock).mockRestore?.();
  (console.warn as jest.Mock).mockRestore?.();
  (console.error as jest.Mock).mockRestore?.();
});

const IconComponentMock = (props: any) =>
  React.createElement('span', { 'data-testid': 'icon', ...props });

jest.mock('@iconify/react', () => ({
  Icon: IconComponentMock,
}));

jest.mock('@iconify/react/dist/iconify.js', () => ({
  Icon: IconComponentMock,
}));

// Mock Next.js navigation hooks for tests
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(() => null),
    entries: jest.fn(() => [].entries()),
  }),
  usePathname: () => "/",
}));
