import type React from 'react';
import { IoInformationCircleOutline } from 'react-icons/io5';
import { FiCheck, FiPlus } from 'react-icons/fi';
import { MdPets } from 'react-icons/md';
import { FaUser } from 'react-icons/fa';
import clsx from 'clsx';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import Datepicker from '@/app/ui/inputs/Datepicker';
import GoogleSearchDropDown from '@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Primary } from '@/app/ui/primitives/Buttons';
import { CompanionType, Gender, SourceType } from '@yosemite-crew/types';
import { StoredParent } from '@/app/features/companions/pages/Companions/types';
import {
  AlertPriority,
  CompanionAlert,
  CountriesOptions,
  CountryDialCodeOption,
  CountryDialCodeOptions,
  InsuredOptions,
  OriginOptions,
} from '@/app/features/companions/components/AddCompanion/type';
import {
  ALERT_PRIORITY_OPTIONS,
  BLOOD_GROUP_OPTIONS_BY_SPECIES,
  BreedOption,
  ExtCompanionForValidation,
  GENDER_NEUTER_OPTIONS,
  ModalMode,
  SpeciesOption,
  toNonNegativeNumber,
} from './addCompanionCentralModalHelpers';
import {
  AlertChipEdit,
  FooterLeft,
  PhotoDropzone,
  SectionHeading,
  SexRadioRow,
  WizardStepHeader,
} from './AddCompanionPresentational';
import InputWithDropdown from './InputWithDropdown';

type SelectOption = { value: string; label: string };
type AddressSelection = {
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
};

type AddCompanionFormModeProps = {
  alertInput: string;
  alertPriority: AlertPriority;
  breedOptions: BreedOption[];
  clientAlertInput: string;
  clientAlertPriority: AlertPriority;
  clientAlerts: CompanionAlert[];
  companionDOB: Date | null;
  companionErrors: Partial<Record<string, string>>;
  companionFormData: ExtCompanionForValidation;
  companionSearchOptions: SelectOption[];
  genderNeuterValue: string;
  localPhoneNumber: string;
  mode: ModalMode;
  /** Wizard step for create mode: 1 = patient details, 2 = parent details. */
  formStep: 1 | 2;
  /** `sheet` renders the phone bottom-sheet single column; `modal` the desktop card. */
  variant: 'modal' | 'sheet';
  onPhotoSelected: (dataUrl: string) => void;
  onSexChange: (gender: string, neutered: boolean) => void;
  onAddAlert: () => void;
  onAddClientAlert: () => void;
  onAddressSelect: (address: AddressSelection) => void;
  onCompanionDOBChange: React.Dispatch<React.SetStateAction<Date | null>>;
  onCompanionSelect: (id: string) => void;
  onCountryCodeSelect: (value: string) => void;
  onParentDOBChange: React.Dispatch<React.SetStateAction<Date | null>>;
  onParentSelect: (parentId: string) => void;
  onPhoneChange: (value: string) => void;
  onRemoveAlert: (id: string) => void;
  onRemoveClientAlert: (id: string) => void;
  onSubmit: () => void;
  onUpdateAddressField: (
    field: 'addressLine' | 'city' | 'state' | 'postalCode',
    value: string
  ) => void;
  parentDOB: Date | null;
  parentErrors: Partial<Record<string, string>>;
  parentFormData: StoredParent;
  parentSearchOptions: SelectOption[];
  scheduleParentSearch: (query: string) => void;
  selectedCountryCode: CountryDialCodeOption;
  setAlertInput: React.Dispatch<React.SetStateAction<string>>;
  setAlertPriority: React.Dispatch<React.SetStateAction<AlertPriority>>;
  setClientAlertInput: React.Dispatch<React.SetStateAction<string>>;
  setClientAlertPriority: React.Dispatch<React.SetStateAction<AlertPriority>>;
  setCompanionErrors: React.Dispatch<React.SetStateAction<Partial<Record<string, string>>>>;
  setCompanionFormData: React.Dispatch<React.SetStateAction<ExtCompanionForValidation>>;
  setMode: React.Dispatch<React.SetStateAction<ModalMode>>;
  setParentErrors: React.Dispatch<React.SetStateAction<Partial<Record<string, string>>>>;
  setParentFormData: React.Dispatch<React.SetStateAction<StoredParent>>;
  speciesOptions: SpeciesOption[];
  terminologyText: (text: string) => string;
};

type CompanionAdditionalDetailsProps = Pick<
  AddCompanionFormModeProps,
  'companionErrors' | 'companionFormData' | 'setCompanionFormData'
>;

const CompanionAdditionalDetails = ({
  companionErrors,
  companionFormData,
  setCompanionFormData,
}: CompanionAdditionalDetailsProps) => (
  <Accordion
    title="Additional Details"
    defaultOpen={false}
    showEditIcon={false}
    titleClassName="text-body-4"
  >
    <div className="flex flex-col gap-3 pt-3 pb-1">
      <div className="grid grid-cols-2 gap-3">
        <FormInput
          intype="text"
          inname="color"
          value={companionFormData.colour || ''}
          inlabel="Color (optional)"
          onChange={(event) =>
            setCompanionFormData((prev) => ({ ...prev, colour: event.target.value }))
          }
          className="min-h-12!"
        />
        <LabelDropdown
          placeholder="Blood group"
          onSelect={(option) =>
            setCompanionFormData((prev) => ({ ...prev, bloodGroup: option.value }))
          }
          defaultOption={companionFormData.bloodGroup || ''}
          options={BLOOD_GROUP_OPTIONS_BY_SPECIES[companionFormData.type] ?? []}
          portal
        />
      </div>
      <LabelDropdown
        placeholder="Country of origin"
        onSelect={(option) =>
          setCompanionFormData((prev) => ({ ...prev, countryOfOrigin: option.value }))
        }
        defaultOption={companionFormData.countryOfOrigin}
        options={CountriesOptions}
        portal
      />
      <div className="grid grid-cols-2 gap-3">
        <FormInput
          intype="text"
          inname="microchip"
          value={companionFormData.microchipNumber || ''}
          inlabel="Microchip no."
          onChange={(event) =>
            setCompanionFormData((prev) => ({
              ...prev,
              microchipNumber: event.target.value,
            }))
          }
          className="min-h-12!"
        />
        <FormInput
          intype="text"
          inname="passport"
          value={companionFormData.passportNumber || ''}
          inlabel="Passport no."
          onChange={(event) =>
            setCompanionFormData((prev) => ({
              ...prev,
              passportNumber: event.target.value.replaceAll(/[^0-9a-zA-Z-]/g, ''),
            }))
          }
          className="min-h-12!"
        />
      </div>
      <LabelDropdown
        placeholder="Source"
        options={OriginOptions}
        defaultOption={companionFormData.source || 'unknown'}
        onSelect={(option) =>
          setCompanionFormData((prev) => ({
            ...prev,
            source: option.value as SourceType,
          }))
        }
        portal
      />
      <LabelDropdown
        placeholder="Insurance"
        options={InsuredOptions}
        defaultOption={companionFormData.isInsured ? 'true' : 'false'}
        onSelect={(option) =>
          setCompanionFormData((prev) => ({
            ...prev,
            isInsured: option.value === 'true',
            insurance: option.value === 'true' ? { isInsured: true } : undefined,
          }))
        }
        portal
      />
      {companionFormData.isInsured && (
        <div className="grid grid-cols-2 gap-3">
          <FormInput
            intype="text"
            inname="insuranceCompany"
            value={companionFormData.insurance?.companyName || ''}
            inlabel="Company name"
            onChange={(event) =>
              setCompanionFormData((prev) => ({
                ...prev,
                insurance: {
                  ...prev.insurance,
                  isInsured: true,
                  companyName: event.target.value,
                },
              }))
            }
            error={companionErrors.insuranceCompany}
            className="min-h-12!"
          />
          <FormInput
            intype="text"
            inname="insurancePolicy"
            value={companionFormData.insurance?.policyNumber || ''}
            inlabel="Policy number"
            onChange={(event) =>
              setCompanionFormData((prev) => ({
                ...prev,
                insurance: {
                  ...prev.insurance,
                  isInsured: true,
                  policyNumber: event.target.value,
                },
              }))
            }
            error={companionErrors.insuranceNumber}
            className="min-h-12!"
          />
        </div>
      )}
      <FormDesc
        intype="text"
        inname="allergies"
        value={companionFormData.allergy || ''}
        inlabel="Allergies"
        onChange={(event) =>
          setCompanionFormData((prev) => ({ ...prev, allergy: event.target.value }))
        }
        className="min-h-22.5!"
      />
    </div>
  </Accordion>
);

type PatientDetailsColumnProps = Pick<
  AddCompanionFormModeProps,
  | 'alertInput'
  | 'alertPriority'
  | 'breedOptions'
  | 'companionDOB'
  | 'companionErrors'
  | 'companionFormData'
  | 'companionSearchOptions'
  | 'genderNeuterValue'
  | 'onAddAlert'
  | 'onCompanionDOBChange'
  | 'onCompanionSelect'
  | 'onPhotoSelected'
  | 'onRemoveAlert'
  | 'onSexChange'
  | 'setAlertInput'
  | 'setAlertPriority'
  | 'setCompanionErrors'
  | 'setCompanionFormData'
  | 'speciesOptions'
  | 'terminologyText'
> & {
  /** Render Sex as Male/Female radios + Neutered checkbox (design add flow) vs the combined dropdown. */
  sexAsRadio: boolean;
};

const PatientSexControl = ({
  sexAsRadio,
  companionFormData,
  genderNeuterValue,
  onSexChange,
  setCompanionFormData,
}: Pick<
  PatientDetailsColumnProps,
  'sexAsRadio' | 'companionFormData' | 'genderNeuterValue' | 'onSexChange' | 'setCompanionFormData'
>) => {
  if (sexAsRadio) {
    return (
      <SexRadioRow
        gender={companionFormData.gender ?? 'unknown'}
        isNeutered={companionFormData.isneutered ?? false}
        onChange={onSexChange}
      />
    );
  }
  return (
    <LabelDropdown
      placeholder="Sex"
      options={GENDER_NEUTER_OPTIONS}
      defaultOption={genderNeuterValue}
      onSelect={(option) => {
        const found = GENDER_NEUTER_OPTIONS.find((item) => item.value === option.value);
        if (found) {
          setCompanionFormData((prev) => ({
            ...prev,
            gender: found.data.gender as Gender,
            isneutered: found.data.neutered,
            ageWhenNeutered: found.data.neutered ? prev.ageWhenNeutered : '',
          }));
        }
      }}
      portal
    />
  );
};

const PatientDetailsColumn = ({
  alertInput,
  alertPriority,
  breedOptions,
  companionDOB,
  companionErrors,
  companionFormData,
  companionSearchOptions,
  genderNeuterValue,
  onAddAlert,
  onCompanionDOBChange,
  onCompanionSelect,
  onPhotoSelected,
  onRemoveAlert,
  onSexChange,
  setAlertInput,
  setAlertPriority,
  setCompanionErrors,
  setCompanionFormData,
  sexAsRadio,
  speciesOptions,
  terminologyText,
}: PatientDetailsColumnProps) => (
  <div className="flex flex-col gap-3">
    <SectionHeading icon={<MdPets size={16} />} title={terminologyText('Patient Details')} />

    <div className="flex items-start gap-3 sm:gap-4">
      <PhotoDropzone
        photoUrl={typeof companionFormData.photoUrl === 'string' ? companionFormData.photoUrl : ''}
        onPhotoSelected={onPhotoSelected}
        className="size-14 sm:size-[72px]"
      />
      <div className="min-w-0 flex-1">
        <InputWithDropdown
          inname="companionName"
          inlabel="Name"
          value={companionFormData.name}
          onChange={(value) => {
            setCompanionFormData((prev) => ({ ...prev, name: value }));
            setCompanionErrors((prev) => ({ ...prev, name: undefined }));
          }}
          onSelect={(option) => onCompanionSelect(option.value)}
          options={companionSearchOptions}
          error={companionErrors.name}
        />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <LabelDropdown
        placeholder="Species"
        onSelect={(option) => {
          const selected = speciesOptions.find((species) => species.value === option.value);
          setCompanionFormData((prev) => ({
            ...prev,
            type: (selected?.type ?? option.value) as CompanionType,
            speciesCode: selected?.speciesCode ?? '',
            breed: '',
            breedCode: '',
            bloodGroup: '',
          }));
        }}
        defaultOption={companionFormData.type}
        options={speciesOptions}
        error={companionErrors.species}
        portal
      />
      <LabelDropdown
        placeholder="Breed"
        onSelect={(option) => {
          const selected = breedOptions.find((breed) => breed.value === option.value);
          setCompanionFormData((prev) => ({
            ...prev,
            breed: option.value,
            breedCode: selected?.breedCode ?? '',
            speciesCode:
              selected?.speciesCode ??
              speciesOptions.find((species) => species.type === prev.type)?.speciesCode ??
              prev.speciesCode,
          }));
        }}
        defaultOption={companionFormData.breed}
        options={breedOptions}
        error={companionErrors.breed}
        portal
      />
      <Datepicker
        currentDate={companionDOB}
        setCurrentDate={onCompanionDOBChange}
        type="input"
        className="min-h-12!"
        containerClassName="w-full"
        placeholder="DOB"
        error={companionErrors.dateOfBirth}
      />
      <FormInput
        intype="number"
        inname="weight"
        value={
          companionFormData.currentWeight == null ? '' : String(companionFormData.currentWeight)
        }
        inlabel="Weight (kg)"
        onChange={(event) =>
          setCompanionFormData((prev) => ({
            ...prev,
            currentWeight: toNonNegativeNumber(event.target.value),
          }))
        }
        className="min-h-12!"
      />
    </div>

    <PatientSexControl
      sexAsRadio={sexAsRadio}
      companionFormData={companionFormData}
      genderNeuterValue={genderNeuterValue}
      onSexChange={onSexChange}
      setCompanionFormData={setCompanionFormData}
    />

    <div className="flex flex-col gap-2.5">
      <span className="text-body-4 text-text-secondary">Alerts (optional)</span>
      <fieldset
        className="grid items-center gap-2"
        style={{ gridTemplateColumns: '1fr 160px 48px' }}
      >
        <legend className="sr-only">Add alert</legend>
        <FormInput
          intype="text"
          inname="alertLabel"
          value={alertInput}
          inlabel="e.g. Diabetic, May bite…"
          onChange={(event) => setAlertInput(event.target.value)}
          className="min-h-12!"
        />
        <LabelDropdown
          placeholder="Priority"
          options={ALERT_PRIORITY_OPTIONS}
          defaultOption={alertPriority}
          onSelect={(option) => setAlertPriority(option.value as AlertPriority)}
          portal
        />
        <button
          type="button"
          aria-label="Add alert"
          onClick={onAddAlert}
          disabled={!alertInput.trim()}
          className={clsx(
            'flex items-center justify-center size-12 rounded-full border transition-colors',
            alertInput.trim()
              ? 'border-input-border-active text-text-brand hover:bg-neutral-50'
              : 'border-card-border text-text-tertiary opacity-40 cursor-not-allowed'
          )}
        >
          <FiPlus size={16} />
        </button>
      </fieldset>

      {(companionFormData.alerts ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(companionFormData.alerts ?? []).map((alert) => (
            <AlertChipEdit key={alert.id} alert={alert} onRemove={onRemoveAlert} />
          ))}
        </div>
      )}
    </div>

    <CompanionAdditionalDetails
      companionErrors={companionErrors}
      companionFormData={companionFormData}
      setCompanionFormData={setCompanionFormData}
    />
  </div>
);

type ClientDetailsColumnProps = Pick<
  AddCompanionFormModeProps,
  | 'clientAlertInput'
  | 'clientAlertPriority'
  | 'clientAlerts'
  | 'localPhoneNumber'
  | 'onAddClientAlert'
  | 'onAddressSelect'
  | 'onCountryCodeSelect'
  | 'onParentDOBChange'
  | 'onParentSelect'
  | 'onPhoneChange'
  | 'onRemoveClientAlert'
  | 'onUpdateAddressField'
  | 'parentDOB'
  | 'parentErrors'
  | 'parentFormData'
  | 'parentSearchOptions'
  | 'scheduleParentSearch'
  | 'selectedCountryCode'
  | 'setClientAlertInput'
  | 'setClientAlertPriority'
  | 'setParentErrors'
  | 'setParentFormData'
>;

const ClientDetailsColumn = ({
  clientAlertInput,
  clientAlertPriority,
  clientAlerts,
  localPhoneNumber,
  onAddClientAlert,
  onAddressSelect,
  onCountryCodeSelect,
  onParentDOBChange,
  onParentSelect,
  onPhoneChange,
  onRemoveClientAlert,
  onUpdateAddressField,
  parentDOB,
  parentErrors,
  parentFormData,
  parentSearchOptions,
  scheduleParentSearch,
  selectedCountryCode,
  setClientAlertInput,
  setClientAlertPriority,
  setParentErrors,
  setParentFormData,
}: ClientDetailsColumnProps) => (
  <div className="flex flex-col gap-3 lg:pl-8">
    <SectionHeading icon={<FaUser size={14} />} title="Client Details" />

    <div className="grid grid-cols-2 gap-3">
      <InputWithDropdown
        inname="firstName"
        inlabel="First name"
        value={parentFormData.firstName}
        onChange={(value) => {
          setParentFormData((prev) => ({ ...prev, firstName: value }));
          setParentErrors((prev) => ({ ...prev, firstName: undefined }));
          scheduleParentSearch([value, parentFormData.lastName].filter(Boolean).join(' '));
        }}
        onSelect={(option) => onParentSelect(option.value)}
        options={parentSearchOptions}
        error={parentErrors.firstName}
      />
      <FormInput
        intype="text"
        inname="lastName"
        value={parentFormData.lastName ?? ''}
        inlabel="Last name"
        onChange={(event) => {
          const nextLastName = event.target.value;
          setParentFormData((prev) => ({ ...prev, lastName: nextLastName }));
          setParentErrors((prev) => ({ ...prev, lastName: undefined }));
          scheduleParentSearch([parentFormData.firstName, nextLastName].filter(Boolean).join(' '));
        }}
        error={parentErrors.lastName}
        className="min-h-12!"
      />
    </div>

    <div className="grid grid-cols-2 gap-3">
      <FormInput
        intype="email"
        inname="email"
        value={parentFormData.email}
        inlabel="Email"
        onChange={(event) => {
          setParentFormData((prev) => ({ ...prev, email: event.target.value }));
          setParentErrors((prev) => ({ ...prev, email: undefined }));
        }}
        error={parentErrors.email}
        className="min-h-12!"
      />
      <div className="flex items-start gap-1.5">
        <Datepicker
          currentDate={parentDOB}
          setCurrentDate={onParentDOBChange}
          type="input"
          className="min-h-12!"
          containerClassName="w-full"
          placeholder="DOB"
          error={parentErrors.dateOfBirth}
        />
        <GlassTooltip
          content="Date of birth may be required in some countries for age verification and legal consent."
          side="bottom"
          maxWidth={360}
        >
          <button
            type="button"
            aria-label="Date of birth information"
            className="mt-3 inline-flex size-5 shrink-0 items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
          >
            <IoInformationCircleOutline size={18} />
          </button>
        </GlassTooltip>
      </div>
    </div>

    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-5">
        <LabelDropdown
          placeholder="Country code"
          onSelect={(option) => onCountryCodeSelect(option.value)}
          defaultOption={selectedCountryCode.value}
          options={CountryDialCodeOptions}
          error={parentErrors.countryCode}
          portal
        />
      </div>
      <div className="col-span-7">
        <FormInput
          intype="text"
          inname="number"
          value={localPhoneNumber || ''}
          inlabel="Phone number"
          onChange={(event) => onPhoneChange(event.target.value)}
          error={parentErrors.phoneNumber}
          className="min-h-12!"
        />
      </div>
    </div>

    <GoogleSearchDropDown
      intype="text"
      inname="address line"
      value={parentFormData.address.addressLine || ''}
      inlabel="Address"
      onChange={(event) => onUpdateAddressField('addressLine', event.target.value)}
      error={parentErrors.addressLine}
      onAddressSelect={onAddressSelect}
      onlyAddress={true}
    />

    <div className="grid grid-cols-2 gap-3">
      <FormInput
        intype="text"
        inname="city"
        value={parentFormData.address.city || ''}
        inlabel="City"
        onChange={(event) => onUpdateAddressField('city', event.target.value)}
        error={parentErrors.city}
        className="min-h-12!"
      />
      <FormInput
        intype="text"
        inname="state"
        value={parentFormData.address.state || ''}
        inlabel="State / Province"
        onChange={(event) => onUpdateAddressField('state', event.target.value)}
        error={parentErrors.state}
        className="min-h-12!"
      />
    </div>

    <FormInput
      intype="text"
      inname="postal code"
      value={parentFormData.address.postalCode || ''}
      inlabel="ZIP"
      onChange={(event) => onUpdateAddressField('postalCode', event.target.value)}
      error={parentErrors.postalCode}
      className="min-h-12!"
    />

    <div className="flex flex-col gap-2.5">
      <span className="text-body-4 text-text-secondary">Alerts (optional)</span>
      <fieldset
        className="grid items-center gap-2"
        style={{ gridTemplateColumns: '1fr 160px 48px' }}
      >
        <legend className="sr-only">Add client alert</legend>
        <FormInput
          intype="text"
          inname="clientAlertLabel"
          value={clientAlertInput}
          inlabel="e.g. Outstanding balance, VIP…"
          onChange={(event) => setClientAlertInput(event.target.value)}
          className="min-h-12!"
        />
        <LabelDropdown
          placeholder="Priority"
          options={ALERT_PRIORITY_OPTIONS}
          defaultOption={clientAlertPriority}
          onSelect={(option) => setClientAlertPriority(option.value as AlertPriority)}
          portal
        />
        <button
          type="button"
          aria-label="Add client alert"
          onClick={onAddClientAlert}
          disabled={!clientAlertInput.trim()}
          className={clsx(
            'flex items-center justify-center size-12 rounded-full border transition-colors',
            clientAlertInput.trim()
              ? 'border-input-border-active text-text-brand hover:bg-neutral-50'
              : 'border-card-border text-text-tertiary opacity-40 cursor-not-allowed'
          )}
        >
          <FiPlus size={16} />
        </button>
      </fieldset>
      {clientAlerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {clientAlerts.map((alert) => (
            <AlertChipEdit key={alert.id} alert={alert} onRemove={onRemoveClientAlert} />
          ))}
        </div>
      )}
    </div>
  </div>
);

const AddCompanionFormMode = (props: AddCompanionFormModeProps) => {
  const { formStep, mode, onSubmit, setCompanionErrors, setMode, setParentErrors, variant } = props;

  const patientColumn = (sexAsRadio: boolean) => (
    <PatientDetailsColumn
      alertInput={props.alertInput}
      alertPriority={props.alertPriority}
      breedOptions={props.breedOptions}
      companionDOB={props.companionDOB}
      companionErrors={props.companionErrors}
      companionFormData={props.companionFormData}
      companionSearchOptions={props.companionSearchOptions}
      genderNeuterValue={props.genderNeuterValue}
      onAddAlert={props.onAddAlert}
      onCompanionDOBChange={props.onCompanionDOBChange}
      onCompanionSelect={props.onCompanionSelect}
      onPhotoSelected={props.onPhotoSelected}
      onRemoveAlert={props.onRemoveAlert}
      onSexChange={props.onSexChange}
      setAlertInput={props.setAlertInput}
      setAlertPriority={props.setAlertPriority}
      setCompanionErrors={setCompanionErrors}
      setCompanionFormData={props.setCompanionFormData}
      sexAsRadio={sexAsRadio}
      speciesOptions={props.speciesOptions}
      terminologyText={props.terminologyText}
    />
  );

  const clientColumn = (
    <ClientDetailsColumn
      clientAlertInput={props.clientAlertInput}
      clientAlertPriority={props.clientAlertPriority}
      clientAlerts={props.clientAlerts}
      localPhoneNumber={props.localPhoneNumber}
      onAddClientAlert={props.onAddClientAlert}
      onAddressSelect={props.onAddressSelect}
      onCountryCodeSelect={props.onCountryCodeSelect}
      onParentDOBChange={props.onParentDOBChange}
      onParentSelect={props.onParentSelect}
      onPhoneChange={props.onPhoneChange}
      onRemoveClientAlert={props.onRemoveClientAlert}
      onUpdateAddressField={props.onUpdateAddressField}
      parentDOB={props.parentDOB}
      parentErrors={props.parentErrors}
      parentFormData={props.parentFormData}
      parentSearchOptions={props.parentSearchOptions}
      scheduleParentSearch={props.scheduleParentSearch}
      selectedCountryCode={props.selectedCountryCode}
      setClientAlertInput={props.setClientAlertInput}
      setClientAlertPriority={props.setClientAlertPriority}
      setParentErrors={setParentErrors}
      setParentFormData={props.setParentFormData}
    />
  );

  // ── Create: the design's 2-step "Add companion" wizard (patient → parent).
  // The step footer is rendered by the parent modal so it can live in the phone
  // sheet's sticky footer region. Both step panels share one column.
  if (mode === 'create') {
    return (
      <div className={variant === 'modal' ? 'mx-auto w-full max-w-[760px]' : 'w-full'}>
        <WizardStepHeader step={formStep} />
        <div className="mt-4">{formStep === 1 ? patientColumn(true) : clientColumn}</div>
      </div>
    );
  }

  // ── Edit: single-scroll two-column layout with its own footer.
  return (
    <>
      <div className="flex items-center gap-2 pb-2 border-b border-card-border">
        <button
          type="button"
          onClick={() => {
            setMode('view');
            setCompanionErrors({});
            setParentErrors({});
          }}
          className="flex items-center gap-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          ← Back to details
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-0 lg:items-stretch">
        {patientColumn(false)}
        {clientColumn}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-card-border">
        <FooterLeft
          setMode={setMode}
          setCompanionErrors={setCompanionErrors}
          setParentErrors={setParentErrors}
        />
        <Primary
          type="button"
          text="Save changes"
          icon={<FiCheck size={15} />}
          onClick={onSubmit}
        />
      </div>
    </>
  );
};

export default AddCompanionFormMode;
