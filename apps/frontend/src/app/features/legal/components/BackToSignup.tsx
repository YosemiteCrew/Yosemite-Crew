'use client';
import React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { IoArrowBack } from 'react-icons/io5';

const BackToSignup = () => {
  const searchParams = useSearchParams();
  const router = useRouter();

  if (searchParams.get('ref') !== 'signup') return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Back to sign up"
      className="fixed top-20 left-5 z-50 flex items-center gap-2 px-4 py-2 text-body-4 text-text-secondary transition-colors duration-200 hover:text-text-primary lg:top-24"
    >
      <IoArrowBack size={16} />
      <span>Back to sign up</span>
    </button>
  );
};

export default BackToSignup;
