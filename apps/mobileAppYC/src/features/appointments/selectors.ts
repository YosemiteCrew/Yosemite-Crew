import {createSelector} from '@reduxjs/toolkit';
import type {RootState} from '@/app/store';
import type {BusinessCategory} from './types';

const selectAppointments = (state: RootState) => state.appointments.items;
const selectCompanionParam = (_: RootState, companionId: string | null) => companionId;

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

export const selectBusinessesByCategory =
  (category?: BusinessCategory) => (state: RootState) => {
    if (category === undefined || category === null) {
      return state.businesses.businesses;
    }

    return state.businesses.businesses.filter(b => b.category === category);
  };

export const selectEmployeesForBusiness = (businessId: string) => (state: RootState) =>
  state.businesses.employees.filter(e => e.businessId === businessId);

export const createSelectEmployeesForBusiness = () =>
  createSelector(
    [(state: RootState) => state.businesses.employees, (_: RootState, businessId: string) => businessId],
    (employees, businessId) => employees.filter(e => e.businessId === businessId),
  );

export const selectAvailabilityFor = (businessId: string, employeeId: string) => (state: RootState) =>
  state.businesses.availability.find(av => av.businessId === businessId && av.employeeId === employeeId) || null;

export const selectInvoiceForAppointment = (appointmentId: string) => (state: RootState) =>
  state.appointments.invoices.find(inv => inv.appointmentId === appointmentId) || null;
