import React from 'react';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';

const AddTask = () => {
  return (
    <div className="flex flex-col gap-6 w-full">
      {/* The panel title and its one section carried the same words, so the
          drawer showed "Add task" twice; the section names what it holds. */}
      <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--ink)]">New task</h2>
      <Accordion title="Task details" defaultOpen showEditIcon={false}></Accordion>
    </div>
  );
};

export default AddTask;
