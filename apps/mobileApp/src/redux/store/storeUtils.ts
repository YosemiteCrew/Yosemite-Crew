import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './index'; // Import the new types

// Use AppDispatch for a typed dispatch hook
export const useAppDispatch = () => useDispatch<AppDispatch>();

// Use RootState for a typed selector hook
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;