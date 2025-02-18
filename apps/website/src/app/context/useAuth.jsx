import { useContext } from 'react';
import { AuthContext } from './AuthContext';

export const useAuth = () => useContext(AuthContext);
