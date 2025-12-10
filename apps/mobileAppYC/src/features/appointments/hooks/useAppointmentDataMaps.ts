import {useMemo} from 'react';
import {useSelector} from 'react-redux';
import type {RootState} from '@/app/store';

/**
 * Hook for creating memoized maps from business, employee, and service data
 * Consolidates map creation logic used across appointment screens
 */
export const useAppointmentDataMaps = () => {
  const businesses = useSelector((s: RootState) => s.businesses?.businesses ?? []);
  const employees = useSelector((s: RootState) => s.businesses?.employees ?? []);
  const services = useSelector((s: RootState) => s.businesses?.services ?? []);

  const businessMap = useMemo(() => new Map(businesses.map(b => [b.id, b])), [businesses]);
  const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const serviceMap = useMemo(() => new Map(services.map(s => [s.id, s])), [services]);

  return {
    businessMap,
    employeeMap,
    serviceMap,
    businesses,
    employees,
    services,
  };
};
