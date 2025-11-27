const React = require('react');
const {View} = require('react-native');

const WebView = React.forwardRef((props, ref) => <View ref={ref} {...props} />);

module.exports = {
  WebView,
  default: WebView,
};
