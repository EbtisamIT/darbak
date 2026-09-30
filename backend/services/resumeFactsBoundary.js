const crypto = require("crypto");
const { isDeepStrictEqual } = require("util");
const contract = require("../../src/features/resume/resumeFactsContract.json");
const { normalizeExperienceFacts, normalizeProjectFacts, normalizeActivityFacts } = require("./resumeFactNormalization");

const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const pick = (value, keys) => Object.fromEntries(keys.filter((key) => own(value, key)).map((key) => [key, value[key]]));
const idOf = (entry) => String(entry.id || entry._id || "");
const listFields = new Set(["userSourceContributions", "technologies", "relevantCoursework", "skills"]);
const collectionLimits = { education: 6, experiences: 8, projects: 8, certifications: 10, volunteering: 8, languages: 8, links: 8 };
const failure = (code, status = 400) => Object.assign(new Error(code), { code, status });

// Read persisted source fields only, never localizedDisplay or generated text.
// Legacy narratives are compatibility reads only when explicit source fields
// are absent. An explicitly cleared source value must stay empty.
const getResumeFormFacts = (stored = {}) => {
  const result = { personalInfo: pick(stored.personalInfo || {}, contract.personalInfo) };
  contract.collections.forEach((section) => {
    const entries = section === "experiences"
      ? (own(stored, "experiences") ? stored.experiences : stored.experience)
      : stored[section];
    result[section] = (Array.isArray(entries) ? entries : []).map((entry) => {
      const normalize = { experiences: normalizeExperienceFacts, projects: normalizeProjectFacts, volunteering: normalizeActivityFacts }[section];
      const legacy = normalize ? normalize(entry) : {};
      return {
        ...pick(entry, contract.entry),
        id: idOf(entry),
        userSourceDescription: own(entry, "userSourceDescription") ? entry.userSourceDescription : legacy.userSourceDescription || "",
        userSourceContributions: own(entry, "userSourceContributions") ? entry.userSourceContributions : legacy.userSourceContributions || [],
      };
    });
  });
  ["languages", "links"].forEach((section) => {
    result[section] = (stored[section] || []).map((entry) => ({ ...pick(entry, contract[section]), id: idOf(entry) }));
  });
  result.skills = Array.isArray(stored.skills) ? [...stored.skills] : [];
  return result;
};

const stableJson = (value) => Array.isArray(value)
  ? `[${value.map(stableJson).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
    : JSON.stringify(value);
const getResumeFactsRevision = (stored = {}) => crypto.createHash("sha256").update(stableJson(getResumeFormFacts(stored))).digest("hex");

const validateObject = (value, keys) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw failure("RESUME_FACTS_INVALID");
  if (Object.keys(value).some((key) => !keys.includes(key))) throw failure("RESUME_FACTS_PRESENTATION_REJECTED");
};
const cleanField = (key, value) => {
  if (key === "isCurrent") {
    if (typeof value !== "boolean") throw failure("RESUME_FACTS_INVALID");
    return value;
  }
  if (listFields.has(key)) {
    if (!Array.isArray(value) || value.length > 50 || value.some((item) => typeof item !== "string")) throw failure("RESUME_FACTS_INVALID");
    return [...new Set(value.map((item) => cleanField("text", item)).filter(Boolean))];
  }
  if (typeof value !== "string" || value.length > 1800) throw failure("RESUME_FACTS_INVALID");
  const text = value.replace(/<[^>]*>/gu, "").trim();
  if ((key === "url" || /Url$/.test(key)) && text && !/^https?:\/\//i.test(text)) throw failure("RESUME_FACTS_INVALID");
  if (key === "studentStatus" && !["", "student", "graduate", "expected_graduate"].includes(text)) throw failure("RESUME_FACTS_INVALID");
  if (key === "grammaticalGender" && !["", "feminine", "masculine"].includes(text)) throw failure("RESUME_FACTS_INVALID");
  return key === "email" ? text.toLowerCase() : text;
};

// Strict at every nesting level. A broad UI/preview payload is rejected before
// any DB write, even if it also contains otherwise valid source fields.
const validateResumeFactsPatch = (body = {}) => {
  validateObject(body, ["personalInfo", ...contract.collections, "languages", "links", "skills"]);
  const patch = {};
  if (own(body, "personalInfo")) {
    validateObject(body.personalInfo, contract.personalInfo);
    patch.personalInfo = Object.fromEntries(Object.entries(body.personalInfo).map(([key, value]) => [key, cleanField(key, value)]));
  }
  [...contract.collections, "languages", "links"].forEach((section) => {
    if (!own(body, section)) return;
    if (!Array.isArray(body[section]) || body[section].length > collectionLimits[section]) throw failure("RESUME_FACTS_INVALID");
    const seen = new Set();
    patch[section] = body[section].map((entry) => {
      validateObject(entry, contract[section] || contract.entry);
      if (typeof entry.id !== "string" || !entry.id.trim() || /[.$<>\u0000-\u001f]/u.test(entry.id) || seen.has(entry.id.trim())) throw failure("RESUME_FACTS_INVALID_ITEM_ID");
      seen.add(entry.id.trim());
      return Object.fromEntries(Object.entries(entry).map(([key, value]) => [key, cleanField(key, value)]));
    });
  });
  if (own(body, "skills")) patch.skills = cleanField("skills", body.skills);
  return patch;
};

// Dotted updates for same-membership collections preserve subdocument IDs and
// approved presentation byte-for-byte. Membership edits retain existing items
// by stable ID; new items receive source fields only, never synthesized bullets.
const buildResumeFactsUpdate = (stored = {}, patch = {}) => {
  const set = {};
  Object.entries(patch.personalInfo || {}).forEach(([key, value]) => {
    if (!isDeepStrictEqual(stored.personalInfo?.[key], value)) set[`personalInfo.${key}`] = value;
  });
  [...contract.collections, "languages", "links"].forEach((section) => {
    if (!own(patch, section)) return;
    const entries = section === "experiences" && !own(stored, section) ? stored.experience || [] : stored[section] || [];
    const sameOrder = own(stored, section) && entries.length === patch[section].length && entries.every((entry, index) => idOf(entry) === patch[section][index].id);
    if (sameOrder) {
      patch[section].forEach((entry, index) => {
        Object.entries(entry).forEach(([key, value]) => {
          if (key !== "id" && !isDeepStrictEqual(entries[index][key], value)) set[`${section}.${index}.${key}`] = value;
        });
      });
    } else {
      const byId = new Map(entries.map((entry) => [idOf(entry), entry]));
      set[section] = patch[section].map((entry) => ({ ...(byId.get(entry.id) || {}), ...entry }));
    }
  });
  if (own(patch, "skills") && !isDeepStrictEqual(stored.skills || [], patch.skills)) set.skills = patch.skills;
  return set;
};

const createResumeFactsHandlers = ({ ResumeProfile, describeSaved = () => ({}) }) => {
  const identity = (req) => ({ contact: req.darbakAccess.contact, accessCodeHash: req.darbakAccess.accessCodeHash });
  const response = (stored) => ({ facts: getResumeFormFacts(stored), version: getResumeFactsRevision(stored) });
  const read = async (req, res) => {
    try {
      const stored = await ResumeProfile.findOne(identity(req)).lean();
      return res.json(response(stored || {}));
    } catch {
      return res.status(500).json({ error: "تعذر تحميل بيانات السيرة." });
    }
  };
  const save = async (req, res) => {
    try {
      const patch = validateResumeFactsPatch(req.body);
      const version = req.get("If-Match");
      if (!version) throw failure("RESUME_FACTS_VERSION_REQUIRED", 428);
      const stored = await ResumeProfile.findOne(identity(req)).lean();
      if (version !== getResumeFactsRevision(stored || {})) throw failure("RESUME_FACTS_VERSION_CONFLICT", 409);
      const changes = buildResumeFactsUpdate(stored || {}, patch);
      if (!Object.keys(changes).length) return res.json(response(stored || {}));
      let saved;
      if (stored) {
        // The revision protects stale facts; updatedAt CAS also protects any
        // presentation approved between the read and this source-only update.
        saved = await ResumeProfile.findOneAndUpdate(
          { _id: stored._id, updatedAt: stored.updatedAt || { $exists: false } },
          { $set: changes },
          { new: true, runValidators: true },
        ).lean();
        if (!saved) throw failure("RESUME_FACTS_VERSION_CONFLICT", 409);
      } else {
        const created = await ResumeProfile.create({
          ...identity(req), userId: req.darbakAccess.user?._id,
          ...patch, workflow: { factsOwner: "resume", lastStep: "review" },
        });
        saved = created.toObject();
      }
      return res.json({ ...response(saved), ...describeSaved(saved, req), message: "تم حفظ بيانات السيرة." });
    } catch (err) {
      const status = err.code === 11000 ? 409 : err.status || 500;
      // No resume text, credentials, or database error body in diagnostics.
      if (status === 500) console.error("Resume facts boundary failed", { code: err.code || "FACTS_SAVE_FAILED" });
      return res.status(status).json({
        code: err.code === 11000 ? "RESUME_FACTS_VERSION_CONFLICT" : err.code || "FACTS_SAVE_FAILED",
        error: status === 409 || status === 428
          ? "تغيرت بيانات السيرة. أعد فتح صفحة المراجعة قبل حفظ تعديلك."
          : "تعذر حفظ بيانات السيرة. أعد فتح صفحة المراجعة وحاول مرة أخرى.",
      });
    }
  };
  return { read, save };
};

module.exports = { getResumeFormFacts, getResumeFactsRevision, validateResumeFactsPatch, buildResumeFactsUpdate, createResumeFactsHandlers };
