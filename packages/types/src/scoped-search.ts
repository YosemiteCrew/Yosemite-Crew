export type ScopedSearchScope =
  | 'TEMPLATE'
  | 'TASK'
  | 'DOCUMENT'
  | 'MEDICATION'
  | 'INVENTORY_ITEM'
  | 'SERVICE'
  | 'PACKAGE';

export interface ScopedSearchItem {
  id: string;
  scope: ScopedSearchScope;
  label: string;
  description: string | null;
  kind: string | null;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ScopedSearchResponse {
  query: string | null;
  page: number;
  pageSize: number;
  total: number;
  items: ScopedSearchItem[];
}
