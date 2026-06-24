const React = require('react');

const MockMapView = React.forwardRef((props, ref) => {
  React.useImperativeHandle(ref, () => ({
    animateToRegion: jest.fn(),
    animateCamera: jest.fn(),
    fitToCoordinates: jest.fn(),
  }));
  return React.createElement('View', {testID: 'map-view', ...props});
});
MockMapView.displayName = 'MapView';

const MockMarker = props =>
  React.createElement('View', {
    testID: `marker-${props.testID ?? 'pin'}`,
    ...props,
  });

const PROVIDER_GOOGLE = 'google';

module.exports = {
  __esModule: true,
  default: MockMapView,
  Marker: MockMarker,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT: null,
  MapView: MockMapView,
};
