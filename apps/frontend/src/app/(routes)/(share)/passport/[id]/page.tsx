import type { Metadata } from 'next';
import { Newsreader } from 'next/font/google';
import PassportClient from './PassportClient';

// Serif display face for the warm-bone passport surfaces (matches the design).
const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Pet Passport',
  // A publicly shared health record must not be indexed.
  robots: { index: false, follow: false },
};

type PassportPageProps = { params: Promise<{ id: string }> };

const PassportPage = async ({ params }: PassportPageProps) => {
  const { id } = await params;
  return (
    <div className={newsreader.variable}>
      <PassportClient id={id} />
    </div>
  );
};

export default PassportPage;
