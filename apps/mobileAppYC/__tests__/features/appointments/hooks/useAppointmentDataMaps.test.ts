import {renderHook} from '@testing-library/react-hooks';
import {useAppointmentDataMaps} from '@/features/appointments/hooks/useAppointmentDataMaps';
import {useSelector} from 'react-redux';

jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
}));

describe('useAppointmentDataMaps', () => {
  const mockBusinesses = [
    {id: 'b1', name: 'Business 1', address: '123 Main St'},
    {id: 'b2', name: 'Business 2', address: '456 Oak Ave'},
  ];

  const mockEmployees = [
    {id: 'e1', name: 'Employee 1', businessId: 'b1'},
    {id: 'e2', name: 'Employee 2', businessId: 'b2'},
  ];

  const mockServices = [
    {id: 's1', name: 'Service 1', price: 50},
    {id: 's2', name: 'Service 2', price: 100},
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useSelector as jest.Mock).mockImplementation((selector: any) => {
      return selector({
        businesses: {
          businesses: mockBusinesses,
          employees: mockEmployees,
          services: mockServices,
        },
      });
    });
  });

  it('should return business, employee, and service maps', () => {
    const {result} = renderHook(() => useAppointmentDataMaps());

    expect(result.current.businessMap).toBeInstanceOf(Map);
    expect(result.current.employeeMap).toBeInstanceOf(Map);
    expect(result.current.serviceMap).toBeInstanceOf(Map);
  });

  it('should create business map with correct entries', () => {
    const {result} = renderHook(() => useAppointmentDataMaps());

    expect(result.current.businessMap.size).toBe(2);
    expect(result.current.businessMap.get('b1')).toEqual(mockBusinesses[0]);
    expect(result.current.businessMap.get('b2')).toEqual(mockBusinesses[1]);
  });

  it('should create employee map with correct entries', () => {
    const {result} = renderHook(() => useAppointmentDataMaps());

    expect(result.current.employeeMap.size).toBe(2);
    expect(result.current.employeeMap.get('e1')).toEqual(mockEmployees[0]);
    expect(result.current.employeeMap.get('e2')).toEqual(mockEmployees[1]);
  });

  it('should create service map with correct entries', () => {
    const {result} = renderHook(() => useAppointmentDataMaps());

    expect(result.current.serviceMap.size).toBe(2);
    expect(result.current.serviceMap.get('s1')).toEqual(mockServices[0]);
    expect(result.current.serviceMap.get('s2')).toEqual(mockServices[1]);
  });

  it('should return raw arrays', () => {
    const {result} = renderHook(() => useAppointmentDataMaps());

    expect(result.current.businesses).toEqual(mockBusinesses);
    expect(result.current.employees).toEqual(mockEmployees);
    expect(result.current.services).toEqual(mockServices);
  });

  it('should handle empty businesses array', () => {
    (useSelector as jest.Mock).mockImplementation((selector: any) => {
      return selector({
        businesses: {
          businesses: [],
          employees: mockEmployees,
          services: mockServices,
        },
      });
    });

    const {result} = renderHook(() => useAppointmentDataMaps());

    expect(result.current.businessMap.size).toBe(0);
    expect(result.current.businesses).toEqual([]);
  });

  it('should handle empty employees array', () => {
    (useSelector as jest.Mock).mockImplementation((selector: any) => {
      return selector({
        businesses: {
          businesses: mockBusinesses,
          employees: [],
          services: mockServices,
        },
      });
    });

    const {result} = renderHook(() => useAppointmentDataMaps());

    expect(result.current.employeeMap.size).toBe(0);
    expect(result.current.employees).toEqual([]);
  });

  it('should handle empty services array', () => {
    (useSelector as jest.Mock).mockImplementation((selector: any) => {
      return selector({
        businesses: {
          businesses: mockBusinesses,
          employees: mockEmployees,
          services: [],
        },
      });
    });

    const {result} = renderHook(() => useAppointmentDataMaps());

    expect(result.current.serviceMap.size).toBe(0);
    expect(result.current.services).toEqual([]);
  });

  it('should handle undefined businesses state', () => {
    (useSelector as jest.Mock).mockImplementation((selector: any) => {
      return selector({
        businesses: undefined,
      });
    });

    const {result} = renderHook(() => useAppointmentDataMaps());

    expect(result.current.businessMap.size).toBe(0);
    expect(result.current.employeeMap.size).toBe(0);
    expect(result.current.serviceMap.size).toBe(0);
    expect(result.current.businesses).toEqual([]);
    expect(result.current.employees).toEqual([]);
    expect(result.current.services).toEqual([]);
  });

  it('should handle null businesses in state', () => {
    (useSelector as jest.Mock).mockImplementation((selector: any) => {
      return selector({
        businesses: {
          businesses: null,
          employees: null,
          services: null,
        },
      });
    });

    const {result} = renderHook(() => useAppointmentDataMaps());

    expect(result.current.businessMap.size).toBe(0);
    expect(result.current.employeeMap.size).toBe(0);
    expect(result.current.serviceMap.size).toBe(0);
  });

  it('should memoize maps when data does not change', () => {
    const {result, rerender} = renderHook(() => useAppointmentDataMaps());

    const firstBusinessMap = result.current.businessMap;
    const firstEmployeeMap = result.current.employeeMap;
    const firstServiceMap = result.current.serviceMap;

    rerender();

    expect(result.current.businessMap).toBe(firstBusinessMap);
    expect(result.current.employeeMap).toBe(firstEmployeeMap);
    expect(result.current.serviceMap).toBe(firstServiceMap);
  });

  it('should update maps when businesses change', () => {
    const {result, rerender} = renderHook(() => useAppointmentDataMaps());

    const newBusinesses = [
      ...mockBusinesses,
      {id: 'b3', name: 'Business 3', address: '789 Pine St'},
    ];

    (useSelector as jest.Mock).mockImplementation((selector: any) => {
      return selector({
        businesses: {
          businesses: newBusinesses,
          employees: mockEmployees,
          services: mockServices,
        },
      });
    });

    rerender();

    expect(result.current.businessMap.size).toBe(3);
    expect(result.current.businessMap.get('b3')).toEqual(newBusinesses[2]);
  });

  it('should update maps when employees change', () => {
    const {result, rerender} = renderHook(() => useAppointmentDataMaps());

    const newEmployees = [
      ...mockEmployees,
      {id: 'e3', name: 'Employee 3', businessId: 'b1'},
    ];

    (useSelector as jest.Mock).mockImplementation((selector: any) => {
      return selector({
        businesses: {
          businesses: mockBusinesses,
          employees: newEmployees,
          services: mockServices,
        },
      });
    });

    rerender();

    expect(result.current.employeeMap.size).toBe(3);
    expect(result.current.employeeMap.get('e3')).toEqual(newEmployees[2]);
  });

  it('should update maps when services change', () => {
    const {result, rerender} = renderHook(() => useAppointmentDataMaps());

    const newServices = [
      ...mockServices,
      {id: 's3', name: 'Service 3', price: 150},
    ];

    (useSelector as jest.Mock).mockImplementation((selector: any) => {
      return selector({
        businesses: {
          businesses: mockBusinesses,
          employees: mockEmployees,
          services: newServices,
        },
      });
    });

    rerender();

    expect(result.current.serviceMap.size).toBe(3);
    expect(result.current.serviceMap.get('s3')).toEqual(newServices[2]);
  });
});
