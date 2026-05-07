import type { Metadata } from 'next';
import LandingPage from '@/app/features/marketing/pages/LandingPage';

export const metadata: Metadata = {
  title: 'Yosemite Crew — Open Source Operating System for Animal Health',
  description:
    'The open-source platform for pet businesses, pet parents, and developers to collaborate in improving animal care.',
};

export default function Home() {
  return <LandingPage />;
}
