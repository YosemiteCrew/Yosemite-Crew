/**
 * Mock for react-native-calendar-events
 */

module.exports = {
  requestPermissions: jest.fn(() => Promise.resolve('authorized')),
  checkPermissions: jest.fn(() => Promise.resolve('authorized')),
  findCalendars: jest.fn(() => Promise.resolve([])),
  saveEvent: jest.fn(() => Promise.resolve('event-id')),
  fetchAllEvents: jest.fn(() => Promise.resolve([])),
  removeEvent: jest.fn(() => Promise.resolve(true)),
};
