import {createSelector} from '@reduxjs/toolkit';
import type {RootState} from '@/app/store';
import type {BusinessCategory} from './types';

const selectAppointments = (state: RootState) => state.appointments.items;
const selectCompanionParam = (_: RootState, companionId: string | null) => companionId;
const selectBusinesses = (state: RootState) => state.businesses.businesses;
const selectServices = (state: RootState) => state.businesses.services;
const selectBusinessCategoryParam = (_: RootState, category?: BusinessCategory) => category;

export const createSelectAppointmentsByCompanion = () =>
  createSelector([selectAppointments, selectCompanionParam], (items, companionId) =>
    items.filter(a => (companionId ? a.companionId === companionId : true)),
  );

export const createSelectUpcomingAppointments = () => {
  const base = createSelectAppointmentsByCompanion();
  return createSelector(base, appointments =>
    appointments.filter(a => a.status !== 'completed' && a.status !== 'canceled'),
  );
};

export const createSelectPastAppointments = () => {
  const base = createSelectAppointmentsByCompanion();
  return createSelector(base, appointments => appointments.filter(a => a.status === 'completed' || a.status === 'canceled'));
};

export const createSelectBusinessesByCategory = () =>
  createSelector([selectBusinesses, selectBusinessCategoryParam], (businesses, category) => {
    if (!category) {
      return businesses;
    }
    return businesses.filter(b => b.category === category);
  });

export const selectEmployeesForBusiness = (businessId: string) => (state: RootState) =>
  state.businesses.employees.filter(e => e.businessId === businessId);

export const createSelectEmployeesForBusiness = () =>
  createSelector(
    [(state: RootState) => state.businesses.employees, (_: RootState, businessId: string) => businessId],
    (employees, businessId) => employees.filter(e => e.businessId === businessId),
  );

export const createSelectServicesForBusiness = () =>
  createSelector(
    [selectServices, (_: RootState, businessId: string) => businessId],
    (services, businessId) => services.filter(s => s.businessId === businessId),
  );

export const selectServiceById = (serviceId?: string | null) => (state: RootState) =>
  serviceId ? state.businesses.services.find(s => s.id === serviceId) ?? null : null;

export const selectAvailabilityFor = (
  businessId: string,
  opts?: {serviceId?: string | null; employeeId?: string | null},
) => (state: RootState) => {
  const availability = state.businesses.availability;
  if (opts?.serviceId) {
    const match = availability.find(av => av.businessId === businessId && av.serviceId === opts.serviceId);
    if (match) return match;
  }
  if (opts?.employeeId) {
    const match = availability.find(av => av.businessId === businessId && av.employeeId === opts.employeeId);
    if (match) return match;
  }
  return availability.find(av => av.businessId === businessId) || null;
};

export const selectInvoiceForAppointment = (appointmentId: string) => (state: RootState) =>
  state.appointments.invoices.find(inv => inv.appointmentId === appointmentId) || null;
