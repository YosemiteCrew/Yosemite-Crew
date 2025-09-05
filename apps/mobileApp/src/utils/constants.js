import moment from 'moment';
import store from '../redux/store';

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
  const match = urlString?.match(/^(?:https?:\/\/)?(?:www\.)?([^:/\s]+)/);
  return match ? match[1] : null;
};

export const formatToLocalISO = (dateStr, timeStr) => {
  // Combine date and time, e.g., "2025-04-22 11:30 AM"
  const dateTimeStr = `${dateStr} ${timeStr}`;

  // Parse using moment with format
  const localMoment = moment(dateTimeStr, 'YYYY-MM-DD hh:mm A');

  // Format as ISO 8601 with local timezone offset (e.g., +05:30)
  return localMoment.format(); // returns ISO string with local offset
};

export const formatDate = (isoString, month) => {
  const date = new Date(isoString);
  const options = {day: '2-digit', month: month || 'short', year: 'numeric'};
  return date.toLocaleDateString('en-GB', options); // DD MMM YYYY
};

export const formatDateDMY = isoString => {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, '0'); // "05"
  const month = String(date.getMonth() + 1).padStart(2, '0'); // "10"
  const year = date.getFullYear(); // "2024"
  return `${day}/${month}/${year}`;
};

export const formatCompleteDateDMY = isoString => {
  const date = new Date(isoString);

  // 1️⃣ build the “5 October 2025” part
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', // no leading zero
    month: 'long', // full month name
    year: 'numeric',
  });

  // 2️⃣ inject the comma before the year
  const [day, month, year] = formatter
    .formatToParts(date)
    .filter(p => p.type !== 'literal') // drop spaces
    .map(p => p.value);

  return `${day} ${month}, ${year}`;
};

export const getCirclePosition = percent => {
  const cx = 59.125;
  const cy = 59.125;
  const R = 45;

  // Clamp percent between 0 and 100
  const clamped = Math.max(0, Math.min(100, percent));
  // Convert percent to angle in radians: 0% = 180°, 100% = 0°
  const angleDeg = 180 - (clamped * 180) / 100;
  const angleRad = (angleDeg * Math.PI) / 180;

  const x = cx + R * Math.cos(angleRad);
  const y = cy - R * Math.sin(angleRad); // negative because SVG y-axis grows downward
  return {x, y};
};

export const maskEmail = email => {
  const [local, domain] = email.split('@');

  // Mask local part: keep first 3 characters, add *
  const maskedLocal = local.length > 3 ? local.slice(0, 3) + '*' : local + '*';

  // Mask domain part: just show `.com` (or last part)
  const domainParts = domain.split('.');
  const tld = domainParts.pop(); // get the last part like 'com'
  const maskedDomain = '*'.repeat(7) + '.' + tld;

  return `${maskedLocal}@${maskedDomain}`;
};

export const recentData = [
  {
    task: 'Monthly Food Supply',
    price: '$30',
    date: '20 Nov 2024',
    billId: '3ZTABC456',
    status: 'Paid',
    businessName: 'DVM Hospital, New Germany',
  },
  {
    task: 'Pet Insurance Premium',
    price: '$30',
    date: '12 Nov 2024',
    billId: '3ZTABC456',
    status: 'Paid',
    businessName: 'DVM Hospital, New Germany',
  },
  {
    task: 'Vaccine',
    price: '$167.77',
    date: '20 Nov 2024',
    billId: '3ZTABC456',
    businessName: 'DVM Hospital, New Germany',
    status: 'Unpaid',
  },
  {
    task: 'Grooming Session',
    price: '$30',
    date: '20 Nov 2024',
    billId: '3ZTABC456',
    businessName: 'URBN Groomers',
    status: 'Paid',
  },
  {
    task: 'Leg Surgery',
    price: '$567.77',
    date: '20 Nov 2024',
    billId: '3ZTABC456',
    businessName: 'DVM Hospital, New Germany',
    status: 'Partially Paid',
  },
  {
    task: 'Behaviour Therapy',
    price: '$67.77',
    date: '20 Nov 2024',
    billId: '3ZTABC456',
    businessName: 'DVM Hospital, New Germany',
    status: 'Overdue',
  },
];

export function getUser() {
  const state = store.getState();
  const userData = state.auth?.user;

  return userData ? userData : null;
}

export const convertDateFormat = dateString => {
  const [day, month, year] = dateString.split('/');
  return `${year}-${month}-${day}`;
};
