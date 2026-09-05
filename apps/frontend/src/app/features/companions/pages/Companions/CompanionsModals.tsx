'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import { CompanionParent } from '@/app/features/companions/pages/Companions/types';
import { isCompanionRevampEnabled } from '@/app/lib/featureFlags';

const AddCompanion = dynamic(() => import('@/app/features/companions/components/AddCompanion'));
const AddCompanionCentralModal = dynamic(
  () => import('@/app/features/companions/components/AddCompanionCentralModal')
);
const CompanionInfo = dynamic(() =>
  import('@/app/features/companions/components').then((m) => ({ default: m.CompanionInfo }))
);
const BookAppointment = dynamic(
  () => import('@/app/features/companions/pages/Companions/BookAppointment')
);
const AddAppointmentCentralModal = dynamic(
  () => import('@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal')
);
const AddTask = dynamic(() => import('@/app/features/companions/pages/Companions/AddTask'));
const ChangeCompanionStatus = dynamic(
  () => import('@/app/features/companions/pages/Companions/ChangeStatus')
);

type SetBoolean = React.Dispatch<React.SetStateAction<boolean>>;

export type CompanionsModalsProps = {
  activeCompanion: CompanionParent | null;
  addPopup: boolean;
  setAddPopup: SetBoolean;
  viewCompanion: boolean;
  setViewCompanion: SetBoolean;
  companionInfoInitialLabel: 'info' | 'history';
  changeStatusPopup: boolean;
  setChangeStatusPopup: SetBoolean;
  bookAppointment: boolean;
  setBookAppointment: SetBoolean;
  addTask: boolean;
  setAddTask: SetBoolean;
  canEditCompanions: boolean;
  canEditAppointments: boolean;
  canEditTasks: boolean;
};

/**
 * Every overlay the companions directory can open, in the order the page
 * mounts them. They are lifted out of the page body so its own control flow
 * stays about the list; each modal keeps the exact permission and
 * feature-flag gate it had inline, so the rendered tree is unchanged.
 */
const CompanionsModals = ({
  activeCompanion,
  addPopup,
  setAddPopup,
  viewCompanion,
  setViewCompanion,
  companionInfoInitialLabel,
  changeStatusPopup,
  setChangeStatusPopup,
  bookAppointment,
  setBookAppointment,
  addTask,
  setAddTask,
  canEditCompanions,
  canEditAppointments,
  canEditTasks,
}: CompanionsModalsProps) => (
  <>
    {isCompanionRevampEnabled() ? (
      <>
        <AddCompanionCentralModal showModal={addPopup} setShowModal={setAddPopup} />
        <AddCompanionCentralModal
          showModal={!!(activeCompanion && viewCompanion)}
          setShowModal={setViewCompanion}
          viewCompanion={activeCompanion}
          canEditCompanionStatus={canEditCompanions}
        />
      </>
    ) : (
      <>
        <AddCompanion showModal={addPopup} setShowModal={setAddPopup} />
        {activeCompanion && viewCompanion && (
          <CompanionInfo
            showModal={viewCompanion}
            setShowModal={setViewCompanion}
            activeCompanion={activeCompanion}
            canEditCompanionStatus={canEditCompanions}
            initialLabel={companionInfoInitialLabel}
          />
        )}
      </>
    )}
    {activeCompanion && canEditCompanions && (
      <ChangeCompanionStatus
        showModal={changeStatusPopup}
        setShowModal={setChangeStatusPopup}
        activeCompanion={activeCompanion}
      />
    )}
    {canEditAppointments &&
      activeCompanion &&
      (isCompanionRevampEnabled() ? (
        <AddAppointmentCentralModal
          showModal={bookAppointment}
          setShowModal={setBookAppointment}
          setActiveFilter={() => undefined}
          setActiveStatus={() => undefined}
          initialCompanionId={activeCompanion.companion.id}
        />
      ) : (
        <BookAppointment
          showModal={bookAppointment}
          setShowModal={setBookAppointment}
          activeCompanion={activeCompanion}
        />
      ))}
    {canEditTasks && activeCompanion && (
      <AddTask showModal={addTask} setShowModal={setAddTask} activeCompanion={activeCompanion} />
    )}
  </>
);

export default CompanionsModals;
