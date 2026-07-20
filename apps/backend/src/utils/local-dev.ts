// Environments in which local-development-only endpoints may run.
//
// This is an allowlist, deliberately not a `NODE_ENV !== "production"` denylist.
// A denylist treats every unexpected value as safe, so an unset, empty or
// misspelled NODE_ENV on a production deploy would enable the very endpoints the
// check exists to keep out - which is exactly the misconfiguration scenario the
// guard is for. An allowlist fails closed: anything that is not a recognised
// local environment is treated as production.
const LOCAL_DEV_ENVIRONMENTS = new Set(["development", "test"]);

export function isLocalDevEnvironment(): boolean {
  return LOCAL_DEV_ENVIRONMENTS.has(process.env.NODE_ENV ?? "");
}
