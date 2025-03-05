export const getMonthYear = () => {
  const date = new Date();
  const options = {month: 'long', year: 'numeric'};
  return date.toLocaleDateString('en-US', options);
};
export const formatMonthYear = dateString => {
  const date = new Date(dateString);
  const options = {month: 'long', year: 'numeric'};
  return date.toLocaleDateString('en-US', options);
};

export const getCurrentMonthAndYear = dateString => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1; // getMonth() returns 0-11, so add 1
  const year = date.getFullYear(); // getFullYear() returns the full year

  return {month, year};
};

// Get current date
export const currentDate = new Date().toISOString().split('T')[0];

export const getShortDayAndDate = dateString => {
  const date = new Date(dateString);
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dateNumber = date.getDate(); // Day of the month (1-31)

  // Convert numeric day to string format (first three letters)
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const shortDayName = daysOfWeek[day];

  return {shortDayName, dateNumber};
};

export const getMonthAndDay = dateString => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1; // getMonth() returns 0-11, so add 1
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysOfWeek = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const DayName = daysOfWeek[day];

  return {month, DayName};
};

export const formatUrl = url => {
  // Check if the URL already starts with "https://"
  if (!url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
};

export const getDomainName = urlString => {
  const match = urlString.match(/^(?:https?:\/\/)?(?:www\.)?([^:/\s]+)/);
  return match ? match[1] : null;
};
