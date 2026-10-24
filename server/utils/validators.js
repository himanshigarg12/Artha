const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// True only for real calendar dates like 2026-10-23 (rejects 2026-13-40)
export const isValidDate = (s) =>
  typeof s === "string" &&
  DATE_RE.test(s) &&
  !isNaN(new Date(s).getTime()) &&
  new Date(s).toISOString().slice(0, 10) === s;