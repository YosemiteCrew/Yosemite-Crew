const Geolocation = {
  requestAuthorization: jest.fn(),
  getCurrentPosition: jest.fn((success, error) =>
    success?.({coords: {latitude: 0, longitude: 0}}),
  ),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
  stopObserving: jest.fn(),
};

module.exports = Geolocation;
