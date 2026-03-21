export const isReadFromPostgres = (): boolean =>
  process.env.READ_FROM_POSTGRES === "true";
