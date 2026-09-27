// A stand-in for one table in a mocked Prisma client. It applies a `where`
// the way the database does for the plain filters link checks use (equality
// and `in`), and an omitted field matches every row, so a check that loosens
// its status filter lets a stored PENDING or REVOKED link back through.
//
// `orderBy` sorts on each key in turn and leaves rows that tie on every key in
// the order they were stored, the way a database returns ties in whatever
// order it finds them, so a query without a tiebreak gets the first stored row.

type Row = Record<string, unknown>;
type OrderBy = Record<string, "asc" | "desc">;
type Query = { where: Row; orderBy?: OrderBy | OrderBy[] };

const matches = (row: Row, where: Row): boolean =>
  Object.entries(where).every(([field, filter]) => {
    if (filter === undefined) return true;
    if (filter !== null && typeof filter === "object" && "in" in filter) {
      return (filter as { in: unknown[] }).in.includes(row[field]);
    }
    return row[field] === filter;
  });

const compare = (a: unknown, b: unknown): number => {
  const x = a instanceof Date ? a.getTime() : (a as number | string);
  const y = b instanceof Date ? b.getTime() : (b as number | string);
  if (x === y) return 0;
  return x < y ? -1 : 1;
};

const sortRows = (rows: Row[], orderBy?: OrderBy | OrderBy[]): Row[] => {
  const keys = (Array.isArray(orderBy) ? orderBy : [orderBy ?? {}]).flatMap(
    (key) => Object.entries(key),
  );
  return [...rows].sort((a, b) => {
    for (const [field, direction] of keys) {
      const order = compare(a[field], b[field]);
      if (order !== 0) return direction === "desc" ? -order : order;
    }
    return 0;
  });
};

export const storedRows = (rows: Row[]) => ({
  findFirst: async ({ where, orderBy }: Query) =>
    sortRows(rows, orderBy).find((row) => matches(row, where)) ?? null,
  findMany: async ({ where, orderBy }: Query) =>
    sortRows(rows, orderBy).filter((row) => matches(row, where)),
});
