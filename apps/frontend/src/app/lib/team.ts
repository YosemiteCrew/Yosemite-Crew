import { RoleCode } from '@/app/lib/permissions';

export const allowDelete = (role: RoleCode) => role !== 'OWNER';
