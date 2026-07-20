import React from 'react';
import Link from 'next/link';
import { IoAddCircleOutline } from 'react-icons/io5';

import './CreateOrgCard.css';

type CreateOrgCardProps = {
  href?: string;
};

const CreateOrgCard = ({ href = '/create-org' }: CreateOrgCardProps) => {
  return (
    <Link href={href} className="create-org-card">
      <IoAddCircleOutline className="create-org-card-icon" size={16} aria-hidden />
      Create a new organization
    </Link>
  );
};

export default CreateOrgCard;
