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
  // Countries flags (you can add more)
  flagUS: require('./icons/back.png'),

  // Logo
} as const;

export type ImageKeys = keyof typeof Images;
