// Production QA completed. Keep this single boundary available for rapid
// containment if a future isolation incident is confirmed.
module.exports = function pauseResumeEnglishUpdates(req, res, next) {
  return next();
};
