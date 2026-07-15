export const KIND_LABELS: Record<string, string> = {
  INPATIENT: 'Inpatient',
  OUTPATIENT: 'Outpatient',
};

export const createAccordionSectionStyles = (theme: any) => ({
  container: {
    marginBottom: theme.spacing['4'],
  },
  parentHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing['2'],
    paddingHorizontal: theme.spacing['1'],
    marginBottom: theme.spacing['3'],
  },
  parentIcon: {
    width: theme.spacing['7'],
    height: theme.spacing['7'],
    resizeMode: 'contain' as const,
  },
  parentTitle: {
    ...theme.typography.sectionHeading,
    color: theme.colors.secondary,
  },
  kindBadgeRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing['2'],
    marginBottom: theme.spacing['2'],
  },
  kindBadge: {
    paddingHorizontal: theme.spacing['2'],
    paddingVertical: theme.spacing['1'],
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.secondaryTint ?? theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderMuted,
  },
  kindBadgeText: {
    ...theme.typography.subtitleBold12,
    color: theme.colors.textSecondary,
  },
  chipContainer: {
    paddingHorizontal: theme.spacing['2'],
    paddingVertical: theme.spacing['1'],
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primaryTint,
  },
  chipText: {
    ...theme.typography.subtitleBold12,
    color: theme.colors.primary,
  },
  selectButton: {
    width: '100%' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderRadius: theme.borderRadius.lg,
  },
  selectButtonText: {
    ...theme.typography.titleSmall,
    color: theme.colors.white,
  },
});
