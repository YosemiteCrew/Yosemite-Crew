import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import ServiceSearch from '@/app/ui/inputs/ServiceSearch/ServiceSearch';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';
import { SpecialityWeb } from '@/app/features/organization/types/speciality';
import { Service } from '@yosemite-crew/types';
import React from 'react';

type SpecialityCardProps = {
  setFormData: React.Dispatch<React.SetStateAction<SpecialityWeb[]>>;
  speciality: SpecialityWeb;
  index: number;
};

const updateServiceList = (
  serviceIndex: number,
  key: keyof Service,
  value: string,
  services: Service[] = []
): Service[] =>
  services.map((service, currentIndex) =>
    currentIndex === serviceIndex ? { ...service, [key]: value } : service
  );

const filterService = (services: Service[], serviceIndex: number) =>
  services.filter((_, index) => index !== serviceIndex);

const SpecialityCard = ({ setFormData, speciality, index }: SpecialityCardProps) => {
  const currency = useCurrencyForPrimaryOrg();

  const updateServiceField = (serviceIndex: number, key: keyof Service, value: string) => {
    setFormData((previous) =>
      previous.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }
        return {
          ...item,
          services: updateServiceList(serviceIndex, key, value, item.services),
        };
      })
    );
  };

  const removeService = (serviceIndex: number) => {
    setFormData((previous) =>
      previous.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }
        return {
          ...item,
          services: filterService(item.services || [], serviceIndex),
        };
      })
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <ServiceSearch speciality={speciality} setSpecialities={setFormData} />
      {speciality.services?.map((service, serviceIndex) => (
        <Accordion
          key={service.name}
          title={service.name}
          defaultOpen
          showEditIcon={false}
          isEditing
          showDeleteIcon
          onDeleteClick={() => removeService(serviceIndex)}
        >
          <div className="flex flex-col gap-3">
            <FormInput
              intype="text"
              inname="description"
              value={service.description || ''}
              inlabel="Description"
              onChange={(event) =>
                updateServiceField(serviceIndex, 'description', event.target.value)
              }
              className="min-h-12!"
            />
            <FormInput
              intype="number"
              inname="duration"
              value={String(service.durationMinutes)}
              inlabel="Duration (mins)"
              onChange={(event) =>
                updateServiceField(serviceIndex, 'durationMinutes', event.target.value)
              }
              className="min-h-12!"
            />
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                intype="number"
                inname="charge"
                value={String(service.cost)}
                inlabel={`Service charge (${currency})`}
                onChange={(event) => updateServiceField(serviceIndex, 'cost', event.target.value)}
                className="min-h-12!"
              />
              <FormInput
                intype="number"
                inname="max-discount"
                value={String(service.maxDiscount)}
                inlabel="Max discount (%)"
                onChange={(event) =>
                  updateServiceField(serviceIndex, 'maxDiscount', event.target.value)
                }
                className="min-h-12!"
              />
            </div>
          </div>
        </Accordion>
      ))}
    </div>
  );
};

export default SpecialityCard;
