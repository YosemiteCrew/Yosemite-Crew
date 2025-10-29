export const formatTimeForDisplay = (time: Date | null): string => {
  if (!time) return '';

  return time.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};
