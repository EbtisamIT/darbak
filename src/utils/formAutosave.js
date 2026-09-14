export const isCurrentAutosaveResponse = ({
  requestId,
  latestRequestId,
  submittedSnapshot,
  latestSnapshot,
} = {}) => requestId === latestRequestId && submittedSnapshot === latestSnapshot;

export const shouldHydrateFormSaveResponse = ({
  manual = false,
  hasNewerChanges = false,
} = {}) => manual && !hasNewerChanges;
