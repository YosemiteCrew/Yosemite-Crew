import React, { useState } from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import AlertPill from '@/app/features/appointments/pages/AppointmentWorkspace/components/AlertPill';
import type { AlertSeverity, CompanionAlert } from '@/app/features/appointments/types/workspace';

type AddAlertModalProps = {
  open: boolean;
  companionName: string;
  subject?: 'companion' | 'client';
  onClose: () => void;
  onAdd: (alert: Omit<CompanionAlert, 'id'>) => void;
};

const SEVERITY_OPTIONS: { value: AlertSeverity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const CLIENT_ALERT_OPTIONS: { value: AlertSeverity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const DEFAULT_SEVERITY: AlertSeverity = 'low';

const getSubjectCopy = (subject: AddAlertModalProps['subject'], displayName: string) => {
  if (subject === 'client') {
    return {
      body: `Add a client alert for ${displayName}.`,
      label: 'Alert (e.g. Call before visit, Billing follow-up)',
      dropdown: 'Severity',
      title: 'Add client alert',
      submit: 'Add client alert',
    };
  }
  return {
    body: `Add a clinical or behavioural alert for ${displayName.split(' ')[0]}.`,
    label: 'Alert (e.g. Needs muzzle, Diabetic)',
    dropdown: 'Severity',
    title: 'Add alert',
    submit: 'Add alert',
  };
};

/**
 * Inner form that owns the label + severity state. The parent remounts it with a
 * fresh `key` each time the modal opens (see AddAlertModal), so a new session
 * always starts blank — no reset effect, and no stale-frame on close.
 */
const AddAlertForm = ({
  companionName,
  subject = 'companion',
  onClose,
  onAdd,
}: {
  companionName: string;
  subject?: NonNullable<AddAlertModalProps['subject']>;
  onClose: () => void;
  onAdd: (alert: Omit<CompanionAlert, 'id'>) => void;
}) => {
  const [label, setLabel] = useState('');
  const [severity, setSeverity] = useState<AlertSeverity>(DEFAULT_SEVERITY);

  const trimmed = label.trim();
  const copy = getSubjectCopy(subject, companionName);
  const options = subject === 'client' ? CLIENT_ALERT_OPTIONS : SEVERITY_OPTIONS;

  const handleAdd = () => {
    if (!trimmed) return;
    onAdd({ label: trimmed, severity });
    onClose();
  };

  return (
    <div className="flex flex-col gap-4 px-2 pb-2">
      <p className="text-body-4 text-text-secondary">{copy.body}</p>
      <FormInput
        intype="text"
        inname="alertLabel"
        value={label}
        inlabel={copy.label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <LabelDropdown
        placeholder={copy.dropdown}
        options={options}
        defaultOption={severity}
        searchable={false}
        onSelect={(option) => setSeverity(option.value as AlertSeverity)}
      />
      {trimmed && (
        <div className="flex items-center gap-2">
          <span className="text-yc-12-r-neutral text-text-secondary">Preview</span>
          <AlertPill label={trimmed} severity={severity} />
        </div>
      )}
      <div className="flex items-center justify-end gap-3 pt-1">
        <Secondary text="Cancel" onClick={onClose} />
        <Primary text={copy.submit} onClick={handleAdd} isDisabled={!trimmed} />
      </div>
    </div>
  );
};

/**
 * Small centered modal to add a companion alert from the workspace. Mirrors the
 * add-alert affordance in the Add Companion central modal (label + severity),
 * reusing the shared `CenterModal`, inputs, and `AlertPill` preview.
 *
 * The form's state lives in `AddAlertForm`, remounted via a `key` tied to `open`
 * so each open starts clean — the canonical "reset a subtree with a key" pattern,
 * which avoids a reset effect (and the brief stale frame it caused on close).
 */
const AddAlertModal = ({
  open,
  companionName,
  subject = 'companion',
  onClose,
  onAdd,
}: AddAlertModalProps) => {
  const copy = getSubjectCopy(subject, companionName);
  return (
    <CenterModal showModal={open} setShowModal={(next) => !next && onClose()} onClose={onClose}>
      <ModalHeader title={copy.title} onClose={onClose} />
      <AddAlertForm
        key={open ? `${subject}-open` : `${subject}-closed`}
        companionName={companionName}
        subject={subject}
        onClose={onClose}
        onAdd={onAdd}
      />
    </CenterModal>
  );
};

export default AddAlertModal;
