export {default as authSlice} from './authSlice';
export {default as themeSlice} from './themeSlice';
export {default as petSlice} from './petSlice';

// Export actions with renamed clearError to avoid conflicts
export {
  loginUser,
  registerUser,
  logoutUser,
  clearAuthError,
  setUser,
} from './authSlice';

export {
  setTheme,
  toggleTheme,
  updateSystemTheme,
} from './themeSlice';

export {
  fetchPets,
  addPet,
  updatePet,
  deletePet,
  clearPetError,
  setSelectedPet,
} from './petSlice';