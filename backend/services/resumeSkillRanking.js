const { normalizeResumeSkills } = require("./resumeSkillNormalization");

const MAX_DISPLAY_SKILLS = 10;

const keyOf = (value = "") => String(value || "")
  .toLocaleLowerCase()
  .replace(/react\.?(?:\s*js)?/gu, "reactjs")
  .replace(/node\.?(?:\s*js)?/gu, "nodejs")
  .replace(/rest\s*apis?/gu, "restapi")
  .replace(/[^\p{L}\p{N}]/gu, "");

const textOf = (entry = {}) => [
  entry.title,
  entry.name,
  entry.description,
  entry.details,
  entry.organization,
  entry.company,
  ...(Array.isArray(entry.achievements) ? entry.achievements.map((item) => item?.text || item?.html || item) : []),
].filter(Boolean).join(" ").toLocaleLowerCase();

const skillAppearsIn = (skill, text) => {
  const normalized = keyOf(skill);
  if (!normalized || !text) return false;
  return keyOf(text).includes(normalized);
};

const relevanceScore = (skill, personalInfo = {}, opportunityKeywords = []) => {
  const major = String(personalInfo.major || "").toLocaleLowerCase();
  const context = [major, personalInfo.academicTrack, ...(opportunityKeywords || [])].join(" ").toLocaleLowerCase();
  const key = keyOf(skill);
  const groups = {
    technical: ["computer", "حاسب", "تقنية", "information technology", "software", "برمج"],
    data: ["data", "analytics", "تحليل", "information systems", "نظم المعلومات"],
    business: ["business", "accounting", "إدارة", "محاسب", "finance", "مالي"],
  };
  const belongsTo = (values) => values.some((value) => context.includes(value));
  if (belongsTo(groups.technical) && /python|reactjs|nodejs|mongodb|restapi|git|github|firebase|sql|html|css|javascript/.test(key)) return 2;
  if (belongsTo(groups.data) && /powerbi|excel|sql|dataanalysis|figma/.test(key)) return 2;
  if (belongsTo(groups.business) && /accounting|excel|financialreporting|dataentry|powerbi/.test(key)) return 2;
  return 0;
};

const professionalUsefulness = (skill, personalInfo = {}) => {
  const major = String(personalInfo.major || "").toLocaleLowerCase();
  const key = keyOf(skill);
  const ranks = major.includes("information systems") || major.includes("نظم المعلومات") || major.includes("data") || major.includes("تحليل")
    ? ["powerbi", "microsoftexcel", "dataanalysis", "sql", "figma", "microsoftpowerpoint"]
    : major.includes("account") || major.includes("محاسب") || major.includes("business") || major.includes("ادارة")
      ? ["accounting", "microsoftexcel", "financialreporting", "dataentry"]
      : ["python", "reactjs", "nodejs", "mongodb", "restapi", "git", "github", "firebase", "figma"];
  const position = ranks.indexOf(key);
  return position === -1 ? 0 : Math.max(0, ranks.length - position);
};

// Presentation-only ranking. It deliberately never creates or removes facts
// from Portfolio; callers receive a deterministic subset of verified skills.
const rankResumeSkills = ({ verifiedSkills = [], evidence = {}, personalInfo = {}, opportunityKeywords = null, max = MAX_DISPLAY_SKILLS } = {}) => {
  const skills = normalizeResumeSkills(verifiedSkills);
  const projects = Array.isArray(evidence.projects) ? evidence.projects : [];
  const experiences = Array.isArray(evidence.experiences) ? evidence.experiences : [];
  const projectText = projects.map(textOf).join(" ");
  const experienceText = experiences.map(textOf).join(" ");

  return skills
    .map((name, sourceIndex) => {
      const projectMatches = projects.filter((entry) => skillAppearsIn(name, textOf(entry))).length;
      const experienceMatches = experiences.filter((entry) => skillAppearsIn(name, textOf(entry))).length;
      const occurrences = projectMatches + experienceMatches;
      const evidenceScore = occurrences >= 2 ? 3 : occurrences === 1 ? 2 : 1;
      const evidenceStrength = evidenceScore === 3 ? "strong" : evidenceScore === 2 ? "moderate" : "weak";
      const score = evidenceScore * 100 + relevanceScore(name, personalInfo, opportunityKeywords) * 10 + professionalUsefulness(name, personalInfo);
      return { name, evidenceStrength, score, sourceIndex, projectBacked: projectMatches > 0, experienceBacked: experienceMatches > 0 };
    })
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "en") || left.sourceIndex - right.sourceIndex)
    .slice(0, Math.max(1, max));
};

module.exports = { MAX_DISPLAY_SKILLS, rankResumeSkills };
