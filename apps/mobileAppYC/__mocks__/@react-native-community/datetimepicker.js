const React = require('react');

// Picks the initial value on mount through `onValueChange`, the listener the
// library calls when a date is chosen.
const DateTimePicker = ({onValueChange, value, ...rest}) => {
  const [date] = React.useState(value ?? new Date());
  React.useEffect(() => {
    if (onValueChange) {
      onValueChange({nativeEvent: {timestamp: date.getTime()}}, date);
    }
  }, [date, onValueChange]);
  return React.createElement('DateTimePicker', {
    testID: 'mock-datetime-picker',
    ...rest,
  });
};

DateTimePicker.displayName = 'MockDateTimePicker';

module.exports = DateTimePicker;
