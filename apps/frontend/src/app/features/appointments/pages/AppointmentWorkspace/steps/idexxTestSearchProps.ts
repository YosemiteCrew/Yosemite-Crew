import type { UseLabTestsReturn } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/LabTests';

/**
 * Shared SearchDropdown props for the IDEXX test search rendered by both the
 * workspace DiagnosticsStep reference-order builder and the appointment-info
 * LabTests reference form. Callers keep their own `onSelect`/`renderOption`.
 */
export const getIdexxTestSearchProps = (s: UseLabTestsReturn) => ({
  options: s.tests.map((test) => ({
    value: test.code,
    label: `${test.display} (${test.code})`,
    meta: test,
  })),
  query: s.selectedTestLabel || s.query,
  setQuery: (value: string) => {
    s.setSelectedTestLabel(value);
    s.setQuery(value);
  },
  minChars: 0,
  onReachEnd: s.loadMoreTests,
  hasMore: s.testsHasMore,
  isLoadingMore: s.testsLoadingMore,
  optionClassName:
    'w-full text-start rounded-2xl! border border-card-border bg-neutral-0 px-3 py-2 mb-2 last:mb-0 hover:bg-neutral-0 transition-colors',
});
