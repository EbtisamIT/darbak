export const shouldAutosaveMasterResume = ({
  hasLoaded,
  resumeMode,
  editingTailoredVersion,
  masterHydrating,
} = {}) => Boolean(
  hasLoaded &&
  resumeMode === "editor" &&
  !editingTailoredVersion &&
  !masterHydrating
);
