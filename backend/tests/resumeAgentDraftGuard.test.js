const assert = require("assert");
const { ensureReviewableAgentOutput } = require("../services/resumeAgentDraftGuard");

const baseOutput = {
  status: "draft_ready",
  message: "مسودتك جاهزة",
  draft: { professionalSummary: "ملخص" },
  pendingDraftId: "",
  applicationPack: {},
  changesSummary: [],
};

const persistedDraft = {
  _id: { toString: () => "pending-123" },
  draft: { professionalSummary: "ملخص محفوظ" },
  applicationPack: { email: { status: "ready" } },
  changesSummary: ["رتبنا النبذة"],
};

const recovered = ensureReviewableAgentOutput(baseOutput, persistedDraft);
assert.strictEqual(recovered.status, "draft_ready");
assert.strictEqual(recovered.pendingDraftId, "pending-123");
assert.strictEqual(recovered.draft.professionalSummary, "ملخص");

const blocked = ensureReviewableAgentOutput(baseOutput, null);
assert.strictEqual(blocked.status, "cannot_continue");
assert.strictEqual(blocked.pendingDraftId, "");
assert.strictEqual(blocked.draft, null);

console.log("resumeAgentDraftGuard tests passed");
