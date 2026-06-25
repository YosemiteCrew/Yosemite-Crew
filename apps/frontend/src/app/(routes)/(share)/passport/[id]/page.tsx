import type { Metadata } from 'next';
import PassportClient from './PassportClient';

export const metadata: Metadata = {
  title: 'Pet Passport',
  // A publicly shared health record must not be indexed.
  robots: { index: false, follow: false },
};

type PassportPageProps = { params: Promise<{ id: string }> };

const PassportPage = async ({ params }: PassportPageProps) => {
  const { id } = await params;
  return <PassportClient id={id} />;
};

export default PassportPage;
