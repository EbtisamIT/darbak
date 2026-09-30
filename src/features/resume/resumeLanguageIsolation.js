// Review/setup share state with standalone versions while a route is loading.
// That state is not a source-facts edit and must never enter the facts endpoint.
export const canSaveResumeFacts = ({ resume, masterHydrating } = {}) => Boolean(
  resume &&
  !masterHydrating &&
  resume.settings?.language !== "en" &&
  resume.settings?.direction !== "ltr"
);

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
