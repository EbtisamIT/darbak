// Temporary P0 containment. Keep saved English previews/downloads available;
// do not generate or replace versions until the isolation incident is cleared.
module.exports = function pauseResumeEnglishUpdates(req, res, next) {
  if (req.method !== "POST") return next();
  // Production QA can pass only after the server verifies the exact QA
  // identity. All other accounts remain behind the incident containment.
  if (req.resumeEnglishQaVerified === true) return next();
  return res.status(503).json({
    code: "RESUME_EN_UPDATE_PAUSED",
    error: "تحديث النسخة الإنجليزية متوقف مؤقتًا لحماية سيرتك. يمكنك فتح النسخة المحفوظة وتحميلها.",
  });
};
