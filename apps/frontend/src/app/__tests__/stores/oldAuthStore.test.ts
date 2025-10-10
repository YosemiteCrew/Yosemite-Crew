import { act } from '@testing-library/react';
import { useOldAuthStore } from '../../stores/oldAuthStore';

describe('useOldAuthStore', () => {
  beforeEach(() => {
    act(() => {
      useOldAuthStore.getState().logout();
    });
  });

  it('should set user data correctly', () => {
    const userData = {
      userId: '123',
      email: 'test@example.com',
      userType: 'Doctor' as const,
      isVerified: 1,
    };

    act(() => {
      useOldAuthStore.getState().setUser(userData);
    });

    expect(useOldAuthStore.getState().userId).toBe(userData.userId);
    expect(useOldAuthStore.getState().email).toBe(userData.email);
    expect(useOldAuthStore.getState().userType).toBe(userData.userType);
    expect(useOldAuthStore.getState().isVerified).toBe(userData.isVerified);
  });

  it('should clear all user data on logout', () => {
    act(() => {
      useOldAuthStore.getState().setUser({
        userId: '123',
        email: 'test@example.com',
        userType: 'Doctor',
        isVerified: 1,
      });
    });

    expect(useOldAuthStore.getState().userId).not.toBeNull();

    act(() => {
      useOldAuthStore.getState().logout();
    });

    expect(useOldAuthStore.getState().userId).toBeNull();
    expect(useOldAuthStore.getState().email).toBeNull();
    expect(useOldAuthStore.getState().userType).toBeNull();
    expect(useOldAuthStore.getState().isVerified).toBeNull();
    expect(useOldAuthStore.getState().profile).toBeNull();
  });

  it('should update the verification status', () => {
    act(() => {
      useOldAuthStore.getState().setVerified(1);
    });
    expect(useOldAuthStore.getState().isVerified).toBe(1);

    act(() => {
      useOldAuthStore.getState().setVerified(0);
    });
    expect(useOldAuthStore.getState().isVerified).toBe(0);
  });

  it('should default to 0 if no value is passed to setVerified', () => {
    act(() => {
      useOldAuthStore.getState().setVerified();
    });
    expect(useOldAuthStore.getState().isVerified).toBe(0);
  });
});