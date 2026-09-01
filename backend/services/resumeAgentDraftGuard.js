const READY_DRAFT_STATUSES = new Set(["draft_ready", "tailored_draft_ready"]);

const hasPendingDraft = (draft = {}) => Boolean(draft?._id || draft?.id);

// A review screen is only valid after its temporary draft exists in storage.
// Models occasionally return a ready status but omit the tool id from their
// final structured response; the server supplies it from the persisted tool
// result instead of letting the UI approve an empty draft.
const ensureReviewableAgentOutput = (output = {}, pendingDraft = null) => {
  if (!READY_DRAFT_STATUSES.has(output.status)) return output;

  if (!hasPendingDraft(pendingDraft)) {
    return {
      ...output,
      status: "cannot_continue",
      message: "تعذر حفظ المسودة للمراجعة. ارجع وحاول مرة أخرى.",
      draft: null,
      pendingDraftId: "",
    };
  }

  return {
    ...output,
    pendingDraftId: pendingDraft._id?.toString?.() || pendingDraft.id?.toString?.() || "",
    draft: output.draft || pendingDraft.draft || null,
    applicationPack: output.applicationPack || pendingDraft.applicationPack || {},
    changesSummary: output.changesSummary?.length ? output.changesSummary : pendingDraft.changesSummary || [],
  };
};

module.exports = {
  ensureReviewableAgentOutput,
};
