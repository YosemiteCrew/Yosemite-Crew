export const useRouter = () => ({
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
});

export const useSearchParams = () => ({
  get: jest.fn(() => null),
  entries: jest.fn(() => [].entries()),
});

export const usePathname = () => "/";
