import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Tasks — Yosemite Crew' };
import React from 'react';
import ProtectedTasks from '@/app/features/tasks/pages/Tasks';

function page() {
  return <ProtectedTasks />;
}

export default page;
