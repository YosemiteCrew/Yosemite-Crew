import {showMessage} from 'react-native-flash-message';

export const showToast = (val, title, color, duration, style) => {
  if (val === 0) {
    showMessage({
      message: title,
      type: 'danger',
      duration: duration ? duration : 5000,
      style: {top: 25},
    });
  }
  if (val === 1) {
    showMessage({
      message: title,
      type: 'success',
      duration: duration ? duration : 5000,
      backgroundColor: color ? color : null,
      style: {top: 25},
    });
  }
};
