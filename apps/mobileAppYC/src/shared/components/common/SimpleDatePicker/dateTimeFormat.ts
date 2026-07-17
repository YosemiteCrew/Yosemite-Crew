export const formatDateForDisplay = (date: Date | null): string => {
  if (!date) return '';

  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(dateObj.getTime())) return '';

    const months = [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ];

    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear();

    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
};

export const formatTimeForDisplay = (time: Date | null): string => {
  if (!time) return '';

  try {
    const timeObj = time instanceof Date ? time : new Date(time);
    if (Number.isNaN(timeObj.getTime())) return '';

    const minutes = timeObj.getMinutes().toString().padStart(2, '0');
    const ampm = timeObj.getHours() >= 12 ? 'PM' : 'AM';
    const displayHours = (timeObj.getHours() % 12 || 12)
      .toString()
      .padStart(2, '0');

    return `${displayHours}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Time formatting error:', error);
    return '';
  }
};
