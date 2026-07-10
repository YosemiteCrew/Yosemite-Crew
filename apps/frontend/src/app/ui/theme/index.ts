// Client-safe barrel. ThemeScript is intentionally NOT re-exported here: it imports
// `next/headers` (server-only), so pulling it through this barrel into a Client
// Component (e.g. the header) breaks the build. Import it directly from
// '@/app/ui/theme/ThemeScript' in server components.
export { useTheme } from '@/app/ui/theme/useTheme';
export type { Theme, Appearance } from '@/app/ui/theme/useTheme';
export { ThemeToggle } from '@/app/ui/theme/ThemeToggle';
