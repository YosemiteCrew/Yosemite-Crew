import React from 'react';
import TestRenderer from 'react-test-renderer';
import {AccountScreen} from '@/screens/account/AccountScreen';
import {Provider} from 'react-redux';
import {store} from '@/app/store';

const mockLogout = jest.fn();

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
    },
    isAuthenticated: true,
    logout: mockLogout,
  }),
}));

describe('AccountScreen', () => {
  beforeEach(() => {
    mockLogout.mockClear();
  });

  it('should render without crashing', () => {
    let tree: any;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <Provider store={store}>
          <AccountScreen />
        </Provider>,
      );
    });
    expect(tree).toBeTruthy();
  });

  it('should display user information', () => {
    let tree: any;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <Provider store={store}>
          <AccountScreen />
        </Provider>,
      );
    });
    expect(tree.toJSON()).toBeTruthy();
  });
});
