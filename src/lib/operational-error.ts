const OPERATIONAL_CODE = /^[A-Z][A-Z0-9_]{2,79}$/;

/** Returns a bounded, non-sensitive classifier suitable for structured logs. */
export function operationalErrorType(error: unknown) {
  if (!(error instanceof Error)) return "UnknownError";
  if (OPERATIONAL_CODE.test(error.message)) return error.message;
  return OPERATIONAL_CODE.test(error.name) || /^[A-Za-z][A-Za-z0-9]{1,79}$/.test(error.name)
    ? error.name
    : "Error";
}
