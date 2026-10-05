const Tracker = require("../models/ApplicationTracker");
const { studentStatusValues } = Tracker;

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}
function text(value, max) {
  if (value == null) return "";
  if (typeof value !== "string" || value.trim().length > max) invalid("يرجى التحقق من طول الحقول المدخلة.");
  return value.trim();
}
function date(value, fallback = null) {
  if (value == null || value === "") return fallback;
  const parsed = new Date(value);
  if (typeof value !== "string" || !Number.isFinite(parsed.getTime())) invalid("التاريخ غير صالح.");
  return parsed;
}
function contactEmail(value) {
  const email = text(value, 254).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid("بريد الجهة غير صالح.");
  return email;
}
function opportunityContactEmail(opportunity = {}) {
  const applicationUrl = typeof opportunity.applicationUrl === "string" ? opportunity.applicationUrl.trim() : "";
  const raw = opportunity.applicationEmail || opportunity.contactEmail ||
    (applicationUrl.toLowerCase().startsWith("mailto:") ? applicationUrl.slice(7).split("?")[0] : applicationUrl);
  return typeof raw === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())
    ? raw.trim().toLowerCase() : "";
}
function trackerOpportunityFields(item = {}, opportunity = {}) {
  if (item.sourceType === "darbak") return {};
  const fields = {};
  if (!item.organizationLogoUrl && opportunity.logoUrl) fields.organizationLogoUrl = opportunity.logoUrl;
  const email = opportunityContactEmail(opportunity);
  if (!item.contactEmail && email) fields.contactEmail = email;
  return fields;
}
function manualFields(input = {}, now = new Date()) {
  const companyName = text(input.companyName, 180);
  if (!companyName) invalid("اسم الجهة مطلوب.");
  const studentStatus = input.studentStatus || "applied";
  if (!studentStatusValues.includes(studentStatus)) invalid("الحالة غير صالحة.");
  const appliedAt = date(input.appliedAt, now);
  return { companyName, roleTitle: text(input.roleTitle, 180), city: text(input.city, 120), contactEmail: contactEmail(input.contactEmail),
    sourceType: "manual", studentStatus, appliedAt, lastUpdatedAt: appliedAt,
    statusHistory: [{ status: studentStatus, changedAt: appliedAt }] };
}
function followUpUpdate(action, now = new Date()) {
  if (action === "sent") return { followUpSentAt: now, followUpSnoozedUntil: null };
  if (action === "snooze") return { followUpSnoozedUntil: new Date(now.getTime() + 3 * 86400000) };
  if (action === "dismiss") return { followUpDismissedAt: now };
  invalid("إجراء المتابعة غير صالح.");
}
function statusUpdate(input = {}, now = new Date()) {
  const fields = { lastUpdatedAt: now };
  if (input.studentStatus !== undefined) {
    if (!studentStatusValues.includes(input.studentStatus)) invalid("الحالة غير صالحة.");
    fields.studentStatus = input.studentStatus;
  }
  if (input.note !== undefined) fields.note = text(input.note, 500);
  if (input.followUpAt !== undefined) fields.followUpAt = date(input.followUpAt);
  if (Object.keys(fields).length === 1) invalid("لا يوجد تحديث لحفظه.");
  return fields;
}
function serializeTracker(item = {}) {
  const id = String(item._id || item.id || "");
  return { ...item, id, _id: id, recordType: "tracker", opportunityId: String(item.opportunityId || ""),
    organizationName: item.companyName || "", opportunityTitle: item.roleTitle || "", companyStatus: "",
    studentStatus: item.studentStatus || "applied", submittedAt: item.appliedAt || item.createdAt,
    appliedAt: item.appliedAt || item.createdAt, lastUpdatedAt: item.lastUpdatedAt || item.updatedAt || item.createdAt,
    statusHistory: item.statusHistory || [] };
}
let indexUpgrade;
function ensureTrackerIndex() {
  if (!indexUpgrade) indexUpgrade = (async () => {
    // Establish the replacement constraint before removing only the legacy index.
    // Linked records remain unique; manual records no longer collide on null.
    await Tracker.collection.createIndex({ opportunityId: 1, studentId: 1 }, {
      unique: true, name: "tracker_student_opportunity_v2",
      partialFilterExpression: { opportunityId: { $type: "objectId" } },
    });
    const indexes = await Tracker.collection.indexes();
    const legacy = indexes.find((index) => index.unique && !index.partialFilterExpression &&
      Object.keys(index.key).length === 2 && index.key.studentId === 1 && index.key.opportunityId === 1);
    if (legacy) {
      try { await Tracker.collection.dropIndex(legacy.name); }
      catch (error) { if (error.code !== 27) throw error; }
    }
  })().catch((error) => { indexUpgrade = null; throw error; });
  return indexUpgrade;
}
async function markApplied(studentAccess, opportunity, Model = Tracker, now = new Date()) {
  const filter = { studentId: studentAccess.accessUser._id, opportunityId: opportunity._id };
  const fields = { ...filter, normalizedEmail: studentAccess.email,
    companyName: opportunity.organizationName || "جهة تدريبية", roleTitle: opportunity.title || "",
    city: opportunity.cities?.length ? opportunity.cities.join("، ") : opportunity.city || "",
    sourceType: opportunity.applicationEmail || opportunity.applicationMethod === "email" ? "email" : "external_link", studentStatus: "applied",
    organizationLogoUrl: opportunity.logoUrl || opportunity.organizationLogoUrl || "", contactEmail: opportunityContactEmail(opportunity),
    opportunityUrl: `/where-to-train/opportunity/training-opportunity/${opportunity._id}`,
    applicationMethod: opportunity.applicationMethod || "", appliedAt: now, lastUpdatedAt: now,
    statusHistory: [{ status: "applied", changedAt: now }] };
  try {
    const result = await Model.findOneAndUpdate(filter, { $setOnInsert: fields }, {
      new: true, upsert: true, setDefaultsOnInsert: true, includeResultMetadata: true,
    });
    return { record: result.value.toObject?.() || result.value, alreadyExists: Boolean(result.lastErrorObject.updatedExisting) };
  } catch (error) {
    if (error.code !== 11000) throw error;
    const record = await Model.findOne(filter).lean();
    if (!record) throw error;
    return { record, alreadyExists: true };
  }
}
module.exports = { manualFields, statusUpdate, followUpUpdate, trackerOpportunityFields, serializeTracker, ensureTrackerIndex, markApplied };
