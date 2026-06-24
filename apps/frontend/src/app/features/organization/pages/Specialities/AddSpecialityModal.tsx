import React, { useState } from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import Primary from '@/app/ui/primitives/Buttons/Primary';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useNotify } from '@/app/hooks/useNotify';

type AddSpecialityModalProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  organisationId: string;
};

const AddSpecialityModal = ({
  showModal,
  setShowModal,
  organisationId,
}: AddSpecialityModalProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const addSpeciality = useRevampCatalogStore((s) => s.addSpeciality);
  const specialities = useRevampCatalogStore((s) => s.specialities);
  const { notify } = useNotify();

  const handleClose = () => {
    setName('');
    setError('');
    setShowModal(false);
  };

  const submitSpeciality = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Speciality name is required.');
      return;
    }
    const exists = specialities.some(
      (s) =>
        s.organisationId === organisationId && s.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setError('A speciality with this name already exists.');
      return;
    }
    try {
      await addSpeciality(trimmed, organisationId);
      notify('success', { title: 'Speciality added', text: `"${trimmed}" has been created.` });
      handleClose();
    } catch {
      notify('error', { title: 'Unable to add speciality', text: 'Please try again.' });
    }
  };

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    Promise.resolve(submitSpeciality()).catch(() => undefined);
  };

  return (
    <CenterModal showModal={showModal} setShowModal={setShowModal} onClose={handleClose}>
      <ModalHeader title="Add Speciality" onClose={handleClose} />
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormInput
          intype="text"
          inlabel="Speciality name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError('');
          }}
          error={error}
        />
        <div className="grid grid-cols-2 gap-3">
          <Secondary href="#" text="Cancel" onClick={handleClose} />
          <Primary
            href="#"
            text="Add Speciality"
            onClick={() => {
              Promise.resolve(submitSpeciality()).catch(() => undefined);
            }}
          />
        </div>
      </form>
    </CenterModal>
  );
};

export default AddSpecialityModal;
