const React = require('react');
const {View} = require('react-native');

const Pdf = React.forwardRef((props, ref) => <View ref={ref} {...props} />);

module.exports = Pdf;
module.exports.default = Pdf;
