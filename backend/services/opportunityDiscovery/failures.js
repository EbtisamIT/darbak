function failureCode(error) {
  const code = String(error?.code || error?.message || error || "");
  if (["SAUDI_EVIDENCE_MISSING", "OPEN_STATUS_UNCONFIRMED"].includes(code)) return code;
  if (/ROBOTS/.test(code)) return "ROBOTS_DENIED";
  if (/TLS|CERT|SSL|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code)) return "TLS_ERROR";
  if (/TIMEOUT|TIME_LIMIT/.test(code)) return "TIMEOUT";
  if (/JAVASCRIPT|DYNAMIC|RENDERING|BROWSER/.test(code)) return "DYNAMIC_PAGE";
  if (/STALE|OLD_OPPORTUNITY|FUTURE_POSTED/.test(code)) return "OLD_OPPORTUNITY";
  if (/NOT_A_TRAINING|NOT_TRAINING/.test(code)) return "NOT_TRAINING";
  if (/NO_STRUCTURED|NO_JOB_CONTENT/.test(code)) return "NO_JOB_CONTENT";
  if (/CLOSED/.test(code)) return "CLOSED";
  if (/INVALID_.*RESPONSE|PARSER|JSON/.test(code) || error instanceof SyntaxError) return "PARSER_FAILED";
  if (/SCOPE|UNAPPROVED|NO_APPROVED_APPLICATION_URL|NON_PUBLIC|COMPANY_MISMATCH|OUTSIDE_SAUDI|POLICY/.test(code)) return "POLICY_DENIED";
  return "FETCH_FAILED";
}
module.exports = { failureCode };
