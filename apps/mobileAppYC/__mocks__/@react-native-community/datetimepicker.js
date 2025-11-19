const React = require('react');

const DateTimePicker = ({onChange, value, ...rest}) => {
  const [date] = React.useState(value ?? new Date());
  React.useEffect(() => {
    if (onChange) {
      onChange({type: 'set', nativeEvent: {timestamp: date.getTime()}}, date);
    }
  }, [date, onChange]);
  return React.createElement('DateTimePicker', {testID: 'mock-datetime-picker', ...rest});
};

DateTimePicker.displayName = 'MockDateTimePicker';

module.exports = DateTimePicker;
