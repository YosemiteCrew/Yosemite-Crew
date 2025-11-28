// src/assets/images/index.ts
export const Images = {
  // Onboarding & Auth
  welcomeIllustration: require('./auth/welcome-illustration.png'),
  authIllustration: require('./auth/auth-illustration.png'),
  verificationSuccess: require('./auth/verification-success.png'),
  catLaptop: require('./auth/cat-laptop.png'),

  // Icons
  offlineImage: require('./icons/offlineImage.png'),
  yosemiteLogo: require('./icons/yosemiteLogo.png'),
  backIcon: require('./icons/back.png'),
  emailIcon: require('./icons/emailIcon.png'),
  facebookIcon: require('./icons/facebookIcon.png'),
  appleIcon: require('./icons/appleIcon.png'),
  googleIcon: require('./icons/googleIcon.png'),
  googleTab: require('./icons/googleTab.png'),
  appleTab: require('./icons/appleTab.png'),
  facebookTab: require('./icons/facebookTab.png'),
  getDirection: require('./icons/getDirection.png'),
  cameraIcon: require('./icons/camera.png'),
  dropdownIcon: require('./icons/dropdown.png'),
  calendarIcon: require('./icons/calendar.png'),
  searchIcon: require('./icons/searchIcon.png'),
  crossIcon: require('./icons/crossIcon.png'),
  blueAddIcon: require('./icons/blueAddIcon.png'),
  addIconDark: require('./icons/addIconDark.png'),
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
downloadInvoice: require('./icons/downloadInvoice.png'),
 phone: require('./icons/phone.png'),
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
  accountMailIcon: require('./icons/emailIcon.png'),
  accountBellIcon: require('./icons/notificationIcon.png'),
  accountShareIcon: require('./icons/shareIcon.png'),
  accountInfoIcon: require('./documents/documentIcon.png'),

  //companion onboarding
  cat: require('./addCompanion/cat.png'),
  dog: require('./addCompanion/dog.png'),
  horse: require('./addCompanion/equine.png'),

  // Documents
  adminIcon: require('./documents/adminIcon.png'),
  healthIconCategory: require('./documents/healthIconCategory.png'),
  hygieneIcon: require('./documents/hygieneIcon.png'),
  dietaryIcon: require('./documents/dietaryIcon.png'),
  othersIconCategory: require('./documents/othersIconCategory.png'),
  documentFallback: require('./documents/documentFallback.png'),
  addIconWhite: require('./documents/addIconWhite.png'),
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
  downloadIcon: require('./icons/downloadInvoice.png'),
  uploadIcon: require('./icons/uploadIcon.png'),
  cameraWhite: require('./icons/cameraWhiteIcon.png'),
  galleryIcon: require('./icons/galleryIcon.png'),
  driveIcon: require('./icons/driveIcon.png'),
  currencyIcon: require('./icons/currencyIcon.png'),

  emptyExpenseIllustration: require('./expense/emptyExpenseIllustration.png'),

  leftArrowIcon: require('./tasks/leftArrow.png'), // Placeholder - use left arrow from Figma
  rightArrowIcon: require('./tasks/rightArrow.png'), // Placeholder - use right arrow from Figma
  clockIcon: require('./tasks/clockIcon.png'), // Placeholder - use clock icon from Figma
  checkCircleIcon: require('./icons/calendar.png'), // Placeholder - use check circle from Figma
  checkIcon: require('./icons/blueAddIcon.png'), // Temporary - use check icon when available
  addIcon: require('./icons/blueAddIcon.png'), // Placeholder - already exists
  editIcon: require('./account/blackEdit.png'), // Placeholder - already exists
  deleteIcon: require('./account/deleteIconRed.png'), // Placeholder - already exists
  googleCalendarIcon: require('./tasks/googleCalendarIcon.png'), // Placeholder - use Google Calendar icon from Figma
  iCloudCalendarIcon: require('./tasks/iCloudCalendarIcon.png'), // Placeholder - use iCloud Calendar icon from Figma
  medicationIcon: require('./documents/prescriptionIcon.png'), // Placeholder - already exists
  observationalToolIcon: require('./documents/labTestIcon.png'), // Placeholder - already exists
  emptyTasksIllustration: require('./documents/emptyDocuments.png'), // Placeholder - use tasks illustration from Figma

  //appointmet mock data
  sampleHospital1: require('./appointment/sampleHospital1.png'),
  sampleHospital2: require('./appointment/sampleHospital2.png'),
  sampleHospital3: require('./appointment/sampleHospital3.png'),
  sampleHospital4: require('./appointment/sampleHospital4.png'),
  sampleHospital5: require('./appointment/sampleHospital5.png'),
  doc1: require('./appointment/doc1.png'),
  doc2: require('./appointment/doc2.png'),
  doc3: require('./appointment/doc3.png'),
  sampleInvoice: require('./appointment/sampleInvoice.png'),
  starOutline: require('./appointment/starOutline.png'),
  starSolid: require('./appointment/starSolid.png'),

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


  // Appointments
  emptyAppointments: require('./appointment/emptyAppointment.png'),
  locationIcon: require('./icons/locationIcon.png'),
  starIcon: require('./icons/starIcon.png'), 
  distanceIcon: require('./icons/distanceIcon.png'), 
  arrowDown: require('./icons/dropdown.png'), 
  websiteIcon: require('./icons/websiteIcon.png'), 
    specialityIcon: require('./appointment/specialityIcon.png'), 

  successPayment: require('./appointment/successPayment.png'),


//Observational Tools
  otFelineHero: require('./addCompanion/cat.png'),
  otCanineHero: require('./addCompanion/dog.png'),
  otEquineHero: require('./addCompanion/equine.png'),
  otNoProviders: require('./observationalTools/no-providers.png'),
  felineEarForward: require('./observationalTools/feline-ear-forward.png'),
  felineEarApart: require('./observationalTools/feline-ear-apart.png'),
  felineEarOutwards: require('./observationalTools/feline-ear-outwards.png'),
  felineOrbitalOpened: require('./observationalTools/feline-orbital-opened.png'),
  felineOrbitalPartial: require('./observationalTools/feline-orbital-partial.png'),
  felineOrbitalSquint: require('./observationalTools/feline-orbital-squint.png'),
  felineMuzzleRelaxed: require('./observationalTools/feline-muzzle-relaxed.png'),
  felineMuzzleMild: require('./observationalTools/feline-muzzle-mild.png'),
  felineMuzzleTense: require('./observationalTools/feline-muzzle-tense.png'),
  felineWhiskerLoose: require('./observationalTools/feline-whisker-loose.png'),
  felineWhiskerStraight: require('./observationalTools/feline-whisker-straight.png'),
  felineWhiskerForward: require('./observationalTools/feline-whisker-forward.png'),
  felineHeadAbove: require('./observationalTools/feline-head-above.png'),
  felineHeadAligned: require('./observationalTools/feline-head-aligned.png'),
  felineHeadBelow: require('./observationalTools/feline-head-below.png'),
  equineEarNotPresent: require('./observationalTools/equine-ear-not-present.png'),
  equineEarModerate: require('./observationalTools/equine-ear-moderate.png'),
  equineEarObvious: require('./observationalTools/equine-ear-obvious.png'),
  equineOrbitalNotPresent: require('./observationalTools/equine-orbital-not-present.png'),
  equineOrbitalModerate: require('./observationalTools/equine-orbital-moderate.png'),
  equineOrbitalObvious: require('./observationalTools/equine-orbital-obvious.png'),
  equineEyeNotPresent: require('./observationalTools/equine-eye-not-present.png'),
  equineEyeModerate: require('./observationalTools/equine-eye-moderate.png'),
  equineEyeObvious: require('./observationalTools/equine-eye-obvious.png'),
  equineChewingNotPresent: require('./observationalTools/equine-chewing-not-present.png'),
  equineChewingModerate: require('./observationalTools/equine-chewing-moderate.png'),
  equineChewingObvious: require('./observationalTools/equine-chewing-obvious.png'),
  equineMouthNotPresent: require('./observationalTools/equine-mouth-not-present.png'),
  equineMouthModerate: require('./observationalTools/equine-mouth-moderate.png'),
  equineMouthObvious: require('./observationalTools/equine-mouth-obvious.png'),
  equineNostrilNotPresent: require('./observationalTools/equine-nostril-not-present.png'),
  equineNostrilModerate: require('./observationalTools/equine-nostril-moderate.png'),
  equineNostrilObvious: require('./observationalTools/equine-nostril-obvious.png'),


  //co-parent
  coparentEmpty: require('./coParent/emptyParent.png'),
   heroImage: require('./coParent/heroImage.png'),
   bgCoParent: require('./coParent/bgCoParent.png'),
  

   //emergency
adverse1: require('./emergency/adverse1.png'),
adverse2: require('./emergency/adverse2.png'),
adverse3: require('./emergency/adverse3.png'),
catEmergency: require('./emergency/catEmergency.png'),
medicalCap: require('./emergency/medicalCap.png'),
pill: require('./emergency/pill.png'),


//notification
bellIcon: require('./icons/notificationIcon.png'),
chatIcon: require('./icons/chatIcon.png'),
alertIcon: require('./icons/alertIcon.png'),
calendarIconNotification: require('./icons/calendar.png'),
syringeIcon: require('./icons/syringeIcon.png'),

emptyNotifications: require('./notification/emptyNotifications.png'),
  // Support & Help
  contactHero: require('./support/contactHero.png'),
} as const;

export type ImageKeys = keyof typeof Images;
