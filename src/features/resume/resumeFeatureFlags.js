// Manual summary improvement is intentionally disabled until its deterministic
// guards can prove that a strong saved summary will never be degraded across
// different candidate profiles. Initial generation and manual editing remain
// available.
export const RESUME_FEATURE_FLAGS = Object.freeze({
  improveSummary: false,
  englishUpdate: false,
});

// The first production deploy leaves English disabled for students. Only the
// dedicated QA identity can expose its action while the server verifies it.
export const isResumeEnglishUpdateEnabled = (identity = {}) =>
  RESUME_FEATURE_FLAGS.englishUpdate ||
  String(identity.contact || "").trim().toLowerCase() ===
    "qa-resume-c8627f9d-20260930@example.invalid";
