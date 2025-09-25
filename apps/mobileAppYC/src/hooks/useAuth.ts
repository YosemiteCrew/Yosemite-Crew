import {useSelector, useDispatch} from 'react-redux';
import {RootState, AppDispatch} from '../store';
import {loginUser, registerUser, logoutUser, clearAuthError} from '../store/slices/authSlice';

export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {isLoggedIn, user, token, isLoading, error} = useSelector(
    (state: RootState) => state.auth,
  );

  const login = (credentials: {email: string; password: string}) => {
    return dispatch(loginUser(credentials));
  };

  const register = (userData: {email: string; password: string; name: string}) => {
    return dispatch(registerUser(userData));
  };

  const logout = () => {
    return dispatch(logoutUser());
  };

  const clearError = () => {
    dispatch(clearAuthError());
  };

  return {
    isLoggedIn,
    user,
    token,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  };
};