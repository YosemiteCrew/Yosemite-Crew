import React from 'react';
import Link from 'next/link';
import { IoAddCircleOutline } from 'react-icons/io5';

type CreateOrgCardProps = {
  href?: string;
};

const CreateOrgCard = ({ href = '/create-org' }: CreateOrgCardProps) => {
  return (
    <Link
      href={href}
      className="flex w-full items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-card-border p-3.5 text-body-4 font-semibold text-text-secondary transition-colors hover:border-primary-600 hover:text-text-primary"
    >
      <IoAddCircleOutline className="text-text-brand" size={18} aria-hidden />
      Create a new organization
    </Link>
  );
};

export default CreateOrgCard;
