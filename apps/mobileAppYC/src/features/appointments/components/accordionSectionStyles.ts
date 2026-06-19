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
});
