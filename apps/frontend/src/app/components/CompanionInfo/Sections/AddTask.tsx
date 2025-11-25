import React from 'react'
import Accordion from '../../Accordion/Accordion'

const AddTask = () => {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="font-grotesk text-black-text text-[23px] font-medium">
        Add task
      </div>
      <Accordion title="Add task" defaultOpen showEditIcon={false}></Accordion>
    </div>
  )
}

export default AddTask