"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { Primary } from "@/app/components/Buttons";
import { FormsProps } from "@/app/types/forms";
import FormsFilters from "@/app/components/Filters/FormsFilters";
import FormsTable from "@/app/components/DataTable/FormsTable";
import AddForm from "./Sections/AddForm";
import FormInfo from "./Sections/FormInfo";
import { useFormsStore } from "@/app/stores/formsStore";
import { loadForms } from "@/app/services/formService";
import {
  useLoadSpecialitiesForPrimaryOrg,
  useServicesForPrimaryOrgSpecialities,
} from "@/app/hooks/useSpecialities";
import OrgGuard from "@/app/components/OrgGuard";

const Forms = () => {
  const { formsById, formIds, activeFormId, setActiveForm, loading } =
    useFormsStore();
  const [filteredList, setFilteredList] = useState<FormsProps[]>([]);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [editingForm, setEditingForm] = useState<FormsProps | null>(null);
  const [draftForm, setDraftForm] = useState<FormsProps | null>(null);
  useLoadSpecialitiesForPrimaryOrg();
  const services = useServicesForPrimaryOrgSpecialities();
  const fetchedRef = useRef(false);

  const list = useMemo<FormsProps[]>(
    () => formIds.map((id) => formsById[id]).filter(Boolean),
    [formIds, formsById]
  );

  const activeForm: FormsProps | null = useMemo(() => {
    const current = activeFormId ? formsById[activeFormId] : null;
    if (current) {
      const presentInFilter = filteredList.some((f) => f._id === current._id);
      if (presentInFilter) return current;
    }
    return filteredList[0] ?? null;
  }, [activeFormId, filteredList, formsById]);

  useEffect(() => {
    setFilteredList(list);
  }, [list]);

  const serviceOptions = useMemo(
    () =>
      services.map((s) => ({
        label: s.name,
        value: s.id || (s as any)._id || s.name,
      })),
    [services]
  );

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void (async () => {
      try {
        if (!list.length) {
          await loadForms();
        }
      } catch (err) {
        console.error("Failed to load forms", err);
      }
    })();
  }, [list.length]);

  useEffect(() => {
    if (!filteredList.length) {
      setActiveForm(null);
      return;
    }
    const isActiveInFilter =
      activeFormId && filteredList.some((item) => item._id === activeFormId);
    if (!isActiveInFilter) {
      const first = filteredList[0];
      if (first?._id) setActiveForm(first._id);
    }
  }, [activeFormId, filteredList, setActiveForm]);

  const openAddForm = () => {
    setEditingForm(null);
    setAddPopup(true);
  };

  const openEditForm = (form: FormsProps) => {
    setDraftForm(null);
    setEditingForm(form);
    setViewPopup(false);
    setAddPopup(true);
  };

  const handleAddClose = () => {
    if (editingForm) {
      setDraftForm(null);
    }
    setEditingForm(null);
  };

  const handleSelectForm = (form: FormsProps) => {
    if (form?._id) {
      setActiveForm(form._id);
    }
  };

  return (
    <div className="flex flex-col gap-6 px-3! py-3! sm:px-12! lg:px-[60px]! sm:py-12!">
      <div className="flex justify-between items-center w-full">
        <div className="text-text-primary text-heading-1">
          Forms
        </div>
        <Primary
          href="#"
          text="Add"
          onClick={openAddForm}
        />
      </div>

      <div className="w-full flex flex-col gap-3">
        <FormsFilters list={list} setFilteredList={setFilteredList} />
        <FormsTable
          filteredList={filteredList}
          activeForm={activeForm}
          setActiveForm={handleSelectForm}
          setViewPopup={setViewPopup}
          loading={loading}
        />
      </div>

      <AddForm
        key={editingForm?._id ? `edit-${editingForm._id}` : "add-form"}
        showModal={addPopup}
        setShowModal={setAddPopup}
        initialForm={editingForm}
        onClose={handleAddClose}
        serviceOptions={serviceOptions}
        draft={editingForm ? null : draftForm}
        onDraftChange={(d) => !editingForm && setDraftForm(d)}
      />
      {activeForm && (
        <FormInfo
          showModal={viewPopup}
          setShowModal={setViewPopup}
          activeForm={activeForm}
          onEdit={openEditForm}
          serviceOptions={serviceOptions}
        />
      )}
    </div>
  );
};

const ProtectedForms = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <Forms />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedForms;
