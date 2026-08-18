import type { Metadata } from 'next';
import CardClient from './CardClient';

export const metadata: Metadata = {
  title: 'Companion Card',
  // A shared identity card must not be indexed.
  robots: { index: false, follow: false },
};

type CardPageProps = { params: Promise<{ token: string }> };

const CardPage = async ({ params }: CardPageProps) => {
  const { token } = await params;
  return <CardClient token={token} />;
};

export default CardPage;
