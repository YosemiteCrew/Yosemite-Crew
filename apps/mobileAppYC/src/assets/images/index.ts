// src/assets/images/index.ts
export const Images = {
  // Onboarding & Auth
  welcomeIllustration: require('./auth/welcome-illustration.png'),
  authIllustration: require('./auth/auth-illustration.png'),
  verificationSuccess: require('./auth/verification-success.png'),
  catLaptop: require('./auth/cat-laptop.png'),

  // Icons
  backIcon: require('./icons/back.png'),
  emailIcon: require('./icons/emailIcon.png'),
  facebookIcon: require('./icons/facebookIcon.png'),
  appleIcon: require('./icons/appleIcon.png'),
  googleIcon: require('./icons/googleIcon.png'),
  googleTab: require('./icons/googleTab.png'),
  appleTab: require('./icons/appleTab.png'),
  facebookTab: require('./icons/facebookTab.png'),
  cameraIcon: require('./icons/camera.png'),
  dropdownIcon: require('./icons/dropdown.png'),
  calendarIcon: require('./icons/calendar.png'),
  searchIcon: require('./icons/searchIcon.png'),
  crossIcon: require('./icons/crossIcon.png'),
  blueAddIcon: require('./icons/blueAddIcon.png'),
  emergencyIcon: require('./icons/emergencyIcon.png'),
  notificationIcon: require('./icons/notificationIcon.png'),
  walletIcon: require('./icons/walletIcon.png'),
  dietryIcon: require('./dashboard/dietryIcon.png'),
  healthIcon: require('./dashboard/healthIcon.png'),
  hygeineIcon: require('./dashboard/hygeineIcon.png'),
  paw: require('./dashboard/paw.png'),
  plusIcon: require('./dashboard/plusIcon.png'),
  editIconSlide: require('./icons/editIconSlide.png'),
    viewIconSlide: require('./icons/viewIconSlide.png'),

  navigation: {
    home: {
      focused: require('./navigation/homeFocused.png'),
      light: require('./navigation/homeLight.png'),
    },
    appointments: {
      focused: require('./navigation/appointmentsFocused.png'),
      light: require('./navigation/appointmentsLight.png'),
    },
    documents: {
      focused: require('./navigation/documentsFocused.png'),
      light: require('./navigation/documentsLight.png'),
    },
    tasks: {
      focused: require('./navigation/tasksFocused.png'),
      light: require('./navigation/tasksLight.png'),
    },
  },
  // Logo
} as const;

export type ImageKeys = keyof typeof Images;
