const { createHash } = require("node:crypto");
const mongoose = require("mongoose");
const Supply = require("../models/AutoApplySupply");
const { normalizeEmail, blockedInbox } = require("./autoApplyEmailNetwork");
const { normalizeCompanyComparable } = require("./companyDirectorySeeds");

const { channelTypes, verificationStatuses } = Supply;
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const keyText = (value) => value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ");

function string(value, max = 300) {
  if (value == null) return "";
  if (typeof value !== "string" || value.trim().length > max) throw new Error("Invalid supply text");
  return value.trim();
}

function list(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 100) throw new Error("Invalid supply list");
  return [...new Set(value.map((item) => string(item)).filter(Boolean))].sort();
}

function optionalDate(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" && !(value instanceof Date)) throw new Error("Invalid supply date");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid supply date");
  return date;
}

function optionalBoolean(value) {
  if (value == null) return null;
  if (typeof value !== "boolean") throw new Error("Invalid supply boolean");
  return value;
}

function webUrl(value) {
  const text = string(value, 2048);
  if (!text) return "";
  const url = new URL(text);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid supply URL");
  return url.href;
}

function urlIdentity(value) {
  const url = new URL(value);
  if (!/^#!?\//.test(url.hash)) url.hash = "";
  for (const name of [...url.searchParams.keys()]) {
    if (/^(utm_.*|gclid|fbclid)$/i.test(name)) url.searchParams.delete(name);
  }
  url.searchParams.sort();
  return url.href;
}

function normalizeObservation(input) {
  const companyName = string(input.companyName);
  const company = normalizeCompanyComparable(companyName);
  const companyId = input.companyId == null ? null : String(input.companyId);
  const sourceType = string(input.sourceType);
  const { channelType } = input;
  if (!company || !sourceType || !channelTypes.includes(channelType) || (companyId && !mongoose.isValidObjectId(companyId))) {
    throw new Error("Invalid supply company, source, or channel");
  }

  const opportunityId = string(input.opportunityId);
  const opportunityTitle = string(input.opportunityTitle);
  const applicationUrl = webUrl(input.applicationUrl);
  const sourceUrl = webUrl(input.sourceUrl);
  const destinationEmail = normalizeEmail(string(input.destinationEmail, 320));
  if (destinationEmail && !/^[^\s@<>,;:"/\\]+@(?:[a-z\d-]+\.)+[a-z\d-]+$/i.test(destinationEmail)) {
    throw new Error("Invalid supply email");
  }
  if (channelType === "EMAIL" && !destinationEmail) throw new Error("Email channel requires a destination");
  if (["EXTERNAL_FORM", "COMPANY_PORTAL"].includes(channelType) && !applicationUrl) {
    throw new Error("Form or portal channel requires an application URL");
  }
  if (channelType === "DARBAK_APPLICATION" && !opportunityId && !applicationUrl && !sourceUrl) {
    throw new Error("Darbak channel requires an opportunity identifier or URL");
  }

  // Use the company name across collectors that may not know the optional Darbak company ID.
  let identity;
  if (channelType === "EMAIL") {
    identity = ["email", company, destinationEmail, opportunityId || keyText(opportunityTitle)];
  } else if (channelType === "DARBAK_APPLICATION" && opportunityId) {
    identity = ["darbak", opportunityId];
  } else if (applicationUrl) {
    identity = ["application", company, urlIdentity(applicationUrl), ...(input.sharedApplicationUrl === true && opportunityId ? [opportunityId] : [])];
  } else {
    identity = ["source", channelType, company, urlIdentity(sourceUrl)];
  }

  const content = {
    companyName, companyId, companyLogo: webUrl(input.companyLogo), opportunityId, opportunityTitle,
    opportunityType: string(input.opportunityType), trainingType: string(input.trainingType),
    channelType, destinationEmail, applicationUrl,
    majors: list(input.majors), fields: list(input.fields), cities: list(input.cities),
    allMajors: optionalBoolean(input.allMajors), allSaudi: optionalBoolean(input.allSaudi),
    remote: optionalBoolean(input.remote), emailTrainingConfirmed: optionalBoolean(input.emailTrainingConfirmed),
    educationLevels: list(input.educationLevels),
    requiredDocuments: input.requiredDocuments == null ? null : list(input.requiredDocuments),
    startDate: optionalDate(input.startDate), deadline: optionalDate(input.deadline),
    sourceUrl, sourceType, evidenceText: string(input.evidenceText, 4000),
    pageTitle: string(input.pageTitle, 500), emailEvidenceText: string(input.emailEvidenceText, 1500),
    applicationEvidenceText: string(input.applicationEvidenceText, 1500), collectorSource: string(input.collectorSource),
    evidencePublishedAt: optionalDate(input.evidencePublishedAt), expiresAt: optionalDate(input.expiresAt),
    ...Object.fromEntries(["employerName", "publisherName", "sourceDomain", "sourceRole", "geographyStatus"].filter((key) =>
      input[key] !== undefined).map((key) => [key, input[key] == null ? null : string(input[key])])),
    ...Object.fromEntries(["discoverySourceUrl", "officialApplicationSourceUrl"].filter((key) => input[key]).map((key) => [key, webUrl(input[key])])),
  };
  return { content, contentHash: hash(content), dedupeKey: hash(identity) };
}

function resolveObservation(input, normalized, previous, now) {
  const { content, contentHash } = normalized;
  const sameContent = previous?.contentHash === contentHash;
  const unchangedVerification = previous && (sameContent || (previous.verificationStatus === "REJECTED" && !previous.classificationHash));
  const isForeign = content.geographyStatus === "NON_SAUDI";
  const status = isForeign ? "REJECTED" : input.verificationStatus ?? (unchangedVerification ? previous.verificationStatus : "NEEDS_REVIEW");
  if (!verificationStatuses.includes(status)) throw new Error("Invalid supply verification status");
  const verificationReason = isForeign ? "The stated training location is outside Saudi Arabia." : input.verificationReason == null && unchangedVerification
    ? previous.verificationReason : string(input.verificationReason, 1000);
  const confidence = input.confidence === undefined && unchangedVerification ? previous.confidence : input.confidence ?? null;
  if (confidence != null && (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
    throw new Error("Invalid supply confidence");
  }

  if (status === "VERIFIED") {
    if (!content.evidenceText || (!content.sourceUrl && content.sourceType !== "official_company_reply") || !verificationReason) {
      throw new Error("Verified supply requires documented evidence and reason");
    }
    const classifiedEmail = sameContent && previous.classification?.contentHash === contentHash && previous.classification.emailExplicitlySupported === true;
    if (content.channelType === "EMAIL" && (!(content.emailTrainingConfirmed === true || classifiedEmail) || blockedInbox(content.destinationEmail))) {
      throw new Error("Email channel is not a verified training inbox");
    }
  }

  const classifiedDeadline = sameContent ? previous.classification?.effectiveDeadline : null;
  const expired = !isForeign && (status === "EXPIRED" || [content.expiresAt, content.deadline, classifiedDeadline].some((value) => value && value <= now));
  const wasClosedByStatus = ["EXPIRED", "REJECTED"].includes(previous?.verificationStatus);
  const activeDefault = wasClosedByStatus ? true : previous?.isActive ?? true;
  const isActive = !expired && status !== "REJECTED" && (optionalBoolean(input.isActive) ?? activeDefault);
  const lastCheckedAt = optionalDate(input.lastCheckedAt);
  const previousCheck = previous?.lastCheckedAt ?? null;
  return {
    ...content, contentHash, confidence, isActive,
    verificationStatus: expired ? "EXPIRED" : status,
    verificationReason: expired && status !== "EXPIRED" ? "Validity period ended" : verificationReason,
    lastCheckedAt: lastCheckedAt && (!previousCheck || lastCheckedAt > previousCheck) ? lastCheckedAt : previousCheck,
  };
}

// The canary reconciles only its recorded IDs. Keep the same record ID and
// admission timestamps, move the unique identity atomically, and keep evidence history.
async function reviseCanarySupply(previous, input, { model = Supply, now = new Date() } = {}) {
  if (!previous?._id || !["LIKELY", "NEEDS_REVIEW"].includes(previous.verificationStatus)) return { action: "skipped", record: previous };
  const normalized = normalizeObservation(input);
  const next = resolveObservation({ ...input, verificationStatus: "NEEDS_REVIEW", isActive: true }, normalized, previous, now);
  if (input.searchQuery) next.searchQuery = string(input.searchQuery, 600);
  const history = Object.fromEntries(Object.keys(model.schema?.paths || Supply.schema.paths)
    .filter((key) => !["_id", "__v", "dedupeKey", "firstSeenAt", "lastSeenAt", "history"].includes(key) && !key.startsWith("classificationAttempt"))
    .map((key) => [key, previous[key]]).filter(([, value]) => value !== undefined));
  try {
    const record = await model.findOneAndUpdate({
      _id: previous._id, __v: previous.__v, contentHash: previous.contentHash, verificationStatus: previous.verificationStatus,
    }, {
      $set: { ...next, dedupeKey: normalized.dedupeKey },
      $unset: { classification: "", classificationAttempt: "", classificationHash: "", classifiedAt: "", classifierVersion: "" },
      $push: { history: { ...history, supersededAt: now } }, $inc: { __v: 1 },
    }, { new: true, runValidators: true, overwriteImmutable: true }).lean();
    return { action: record ? "updated" : "conflict", record };
  } catch (error) {
    if (error.code === 11000) return { action: "duplicate_identity", record: null };
    throw error;
  }
}

async function ingestSupply(input, { model = Supply, now = new Date(), createIfMissing = true, preserveExisting = false } = {}) {
  const normalized = normalizeObservation(input);
  const { dedupeKey } = normalized;
  if (model === Supply) await Supply.init();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const previous = await model.findOne({ dedupeKey }).lean();
    if (!previous && !createIfMissing) return { action: "limited", record: null };
    if (previous && preserveExisting) return { action: "duplicate", record: previous };
    const observation = resolveObservation(input, normalized, previous, now);
    if (input.searchQuery || previous?.searchQuery) observation.searchQuery = string(input.searchQuery || previous.searchQuery, 600);
    if (!previous) {
      try {
        const record = await model.create({ ...observation, dedupeKey, firstSeenAt: now, lastSeenAt: now });
        return { action: record.verificationStatus === "EXPIRED" ? "expired" : "created", record, isNew: true };
      } catch (error) {
        if (error.code !== 11000) throw error;
        continue;
      }
    }

    const unchanged = ["contentHash", "verificationStatus", "verificationReason", "confidence", "isActive"]
      .every((field) => (previous[field] ?? null) === (observation[field] ?? null));
    const update = {
      $set: unchanged ? { lastCheckedAt: observation.lastCheckedAt,
        ...(!previous.searchQuery && observation.searchQuery ? { searchQuery: observation.searchQuery } : {}) } : observation,
      $max: { lastSeenAt: now },
      $inc: { __v: 1 },
    };
    if (!unchanged) {
      const oldObservation = Object.fromEntries(Object.keys(observation).map((key) => [key, previous[key]]));
      for (const key of ["classification", "classificationHash", "classifiedAt", "classifierVersion"]) {
        if (previous[key] !== undefined) oldObservation[key] = previous[key];
      }
      update.$push = { history: { ...oldObservation, supersededAt: now } };
      if (previous.contentHash !== observation.contentHash) {
        update.$unset = { classification: "", classificationAttempt: "", classificationHash: "", classifiedAt: "", classifierVersion: "" };
      }
    }
    const record = await model.findOneAndUpdate({ _id: previous._id, __v: previous.__v }, update,
      { new: true, runValidators: true }).lean();
    if (record) {
      let action = unchanged ? "duplicate" : "updated";
      if (!unchanged && record.verificationStatus === "EXPIRED" && previous.verificationStatus !== "EXPIRED") action = "expired";
      if (!previous.isActive && record.isActive) action = "reactivated";
      return { action, record };
    }
  }
  throw new Error("Concurrent supply update; retry ingestion");
}

// Record a check without claiming the opportunity was seen again or replacing its evidence.
async function recordSupplyRecheck(previous, { model = Supply, now = new Date() } = {}) {
  const due = [previous.deadline, previous.expiresAt, previous.classification?.effectiveDeadline].some((date) => date && date <= now);
  const expired = due && previous.verificationStatus !== "EXPIRED";
  const update = { $max: { lastCheckedAt: now }, $inc: { __v: 1 } };
  if (expired) {
    const { _id, __v, dedupeKey, firstSeenAt, lastSeenAt, history, ...prior } = previous;
    update.$set = { isActive: false, verificationStatus: "EXPIRED", verificationReason: "Validity period ended" };
    update.$push = { history: { ...prior, supersededAt: now } };
  }
  const record = await model.findOneAndUpdate({ _id: previous._id, __v: previous.__v }, update,
    { new: true, runValidators: true }).lean();
  return { action: !record ? "superseded" : expired ? "expired" : "checked", record };
}

function eligibleSupplyFilter(now = new Date()) {
  return {
    verificationStatus: "VERIFIED", isActive: true, channelType: { $in: [...channelTypes] },
    $and: ["expiresAt", "deadline", "classification.effectiveDeadline"].map((field) => ({ $or: [{ [field]: null }, { [field]: { $gt: now } }] })),
  };
}

function findEligibleSupply({ model = Supply, now = new Date(), limit = 100, afterId } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 || (afterId != null && !mongoose.isValidObjectId(afterId))) {
    throw new Error("Invalid supply query page");
  }
  const filter = eligibleSupplyFilter(now);
  if (afterId != null) filter._id = { $gt: afterId };
  return model.find(filter).sort({ _id: 1 }).limit(limit).lean();
}

module.exports = { ingestSupply, eligibleSupplyFilter, findEligibleSupply, recordSupplyRecheck, reviseCanarySupply,
  supplyDedupeKey: (input) => normalizeObservation(input).dedupeKey };
