'use client';
import React from 'react';
import { redirect } from 'next/navigation';

import ForgotPasswordPage from '@/app/features/auth/pages/ForgotPassword/ForgotPassword';
import { useAuthStore } from '@/app/stores/authStore';
import { resolveDefaultOpenScreenRoute } from '@/app/lib/defaultOpenScreen';

export default function ForgotPasswordPageWrapper() {
  const { user, role } = useAuthStore();

  if (user) redirect(resolveDefaultOpenScreenRoute(role));

  return <ForgotPasswordPage />;
}
