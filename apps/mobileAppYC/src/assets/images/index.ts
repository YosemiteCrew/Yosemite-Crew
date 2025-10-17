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
  closeIcon: require('./icons/crossIcon.png'),

  // Account
  logoutIcon: require('./account/logoutIcon.png'),
  blackEdit: require('./account/blackEdit.png'),
  rightArrow: require('./account/rightArrow.png'),
  faqIcon: require('./account/faqIcon.png'),
  aboutusIcon: require('./account/aboutusIcon.png'),
  tncIcon: require('./account/tncIcon.png'),
  privacyIcon: require('./account/privacyIcon.png'),
  contactIcon: require('./account/contactIcon.png'),
  deleteIconRed: require('./account/deleteIconRed.png'),


  //companion onboarding
    cat: require('./addCompanion/cat.png'),
    dog: require('./addCompanion/dog.png'),
    horse: require('./addCompanion/equine.png'),

  // Documents
  emptyDocuments: require('./documents/emptyDocuments.png'),
  documentIcon: require('./documents/documentIcon.png'),
  passportIcon: require('./documents/passportIcon.png'),
  certificateIcon: require('./documents/certificateIcon.png'),
  insuranceIcon: require('./documents/insuranceIcon.png'),
  hospitalIcon: require('./documents/hospitalIcon.png'),
  prescriptionIcon: require('./documents/prescriptionIcon.png'),
  vaccinationIcon: require('./documents/vaccinationIcon.png'),
  labTestIcon: require('./documents/labTestIcon.png'),
  groomingIcon: require('./documents/groomingIcon.png'),
  boardingIcon: require('./documents/boardingIcon.png'),
  trainingIcon: require('./documents/trainingIcon.png'),
  breederIcon: require('./documents/breederIcon.png'),
  nutritionIcon: require('./documents/nutritionIcon.png'),
  othersIcon: require('./documents/othersIcon.png'),
  shareIcon: require('./icons/shareIcon.png'),
  uploadIcon: require('./icons/uploadIcon.png'),
  cameraWhiteIcon: require('./icons/cameraWhite.png'),
  galleryIcon: require('./icons/galleryIcon.png'),
  driveIcon: require('./icons/driveIcon.png'),







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
