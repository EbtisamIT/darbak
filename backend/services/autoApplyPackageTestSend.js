const crypto = require("node:crypto");
const { assertTestSendAllowed } = require("./autoApplyGmailSend");

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();

function testRecipientOverride(env = process.env) {
  const explicit = normalizeEmail(env.AUTO_APPLY_GMAIL_E2E_TEST_RECIPIENT);
  const allowlisted = String(env.AUTO_APPLY_GMAIL_TEST_RECIPIENTS || "").split(",")
    .map(normalizeEmail).filter(Boolean);
  const recipient = explicit || (allowlisted.length === 1 ? allowlisted[0] : "");
  if (!recipient) throw Object.assign(new Error("GMAIL_TEST_RECIPIENT_NOT_CONFIGURED"), { status: 404 });
  return assertTestSendAllowed({ recipient, env });
}

function applicationDraft(input = {}) {
  const subject = String(input.subject || "").trim();
  const body = String(input.body || "").trim();
  if (!subject || !body || subject.length > 300 || body.length > 5000) {
    throw Object.assign(new Error("AUTO_APPLY_TEST_DRAFT_INVALID"), { status: 400 });
  }
  return { subject, body };
}

function selectedResumeAttachment(asset) {
  const bytes = Buffer.isBuffer(asset?.pdf) ? asset.pdf
    : Buffer.isBuffer(asset?.pdf?.buffer) ? asset.pdf.buffer : null;
  const sha256 = bytes ? crypto.createHash("sha256").update(bytes).digest("hex") : "";
  if (!bytes?.length || bytes.subarray(0, 5).toString("ascii") !== "%PDF-" ||
    !bytes.includes(Buffer.from("%%EOF")) || sha256 !== asset?.sha256) {
    throw Object.assign(new Error("AUTO_APPLY_TEST_RESUME_INVALID"), { status: 400 });
  }
  const filename = String(asset.filename || "auto-apply-resume.pdf").trim();
  return { filename: filename.toLowerCase().endsWith(".pdf") ? filename : "auto-apply-resume.pdf",
    mimeType: "application/pdf", bytes, sha256 };
}

function assertCompanyRecipientBlocked(originalTargetEmail, testRecipient) {
  if (!normalizeEmail(originalTargetEmail) || normalizeEmail(originalTargetEmail) === normalizeEmail(testRecipient)) {
    throw Object.assign(new Error("AUTO_APPLY_TEST_DESTINATION_UNSAFE"), { status: 403 });
  }
}

module.exports = { testRecipientOverride, applicationDraft, selectedResumeAttachment, assertCompanyRecipientBlocked };
