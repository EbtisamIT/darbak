const { normalizeResumeSkill, normalizeResumeSkills } = require("./resumeSkillNormalization");

const MAX_DISPLAY_SKILLS = 10;

const keyOf = (value = "") => String(value || "")
  .toLocaleLowerCase()
  .replace(/react\.?(?:\s*js)?/gu, "reactjs")
  .replace(/node\.?(?:\s*js)?/gu, "nodejs")
  .replace(/rest\s*apis?/gu, "restapi")
  .replace(/[^\p{L}\p{N}]/gu, "");

const listText = (value) => (Array.isArray(value) ? value : [])
  .map((item) => typeof item === "string" ? item : item?.name || item?.title || item?.text || item?.html || "")
  .filter(Boolean);

const structuredSkillsOf = (entry = {}) => normalizeResumeSkills([
  ...listText(entry.tools),
  ...listText(entry.technologies),
  ...listText(entry.skills),
]);

const textOf = (entry = {}) => [
  entry.title,
  entry.name,
  entry.description,
  entry.details,
  ...listText(entry.responsibilities),
  ...listText(entry.bullets),
  ...listText(entry.achievements),
].filter(Boolean).join(" ").toLocaleLowerCase();

const EVIDENCE_ALIASES = {
  microsoftexcel: ["microsoft excel", "excel"],
  microsoftpowerpoint: ["microsoft powerpoint", "powerpoint"],
  powerbi: ["power bi", "powerbi"],
  reactjs: ["react.js", "react js", "reactjs", "react"],
  nodejs: ["node.js", "node js", "nodejs"],
  restapi: ["rest api", "rest apis", "restful api", "restful apis"],
  dataanalysis: ["data analysis", "تحليل البيانات"],
  financialreporting: ["financial reporting", "financial reports", "التقارير المالية", "تقارير مالية"],
};

const proseMentionsSkill = (skill, text) => {
  const skillKey = keyOf(skill);
  if (!skillKey || !text) return false;
  const normalizedText = String(text).toLocaleLowerCase();
  const aliases = EVIDENCE_ALIASES[skillKey] || [normalizeResumeSkill(skill).toLocaleLowerCase()];
  return aliases.some((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu").test(normalizedText);
  });
};

const skillAppearsIn = (skill, entry) => {
  const wanted = keyOf(normalizeResumeSkill(skill));
  if (structuredSkillsOf(entry).some((candidate) => keyOf(candidate) === wanted)) return true;
  return proseMentionsSkill(skill, textOf(entry));
};

const relevanceScore = (skill, { major = "", academicTrack = "", opportunityKeywords = [] } = {}) => {
  const context = [major, academicTrack, ...(opportunityKeywords || [])].join(" ").toLocaleLowerCase();
  const key = keyOf(skill);
  const groups = {
    technical: ["computer", "حاسب", "تقنية", "information technology", "software", "برمج"],
    data: ["data", "analytics", "تحليل", "information systems", "نظم المعلومات"],
    business: ["business", "accounting", "إدارة", "ادارة", "محاسب", "finance", "مالي"],
  };
  const belongsTo = (values) => values.some((value) => context.includes(value));
  if (belongsTo(groups.technical) && /python|reactjs|nodejs|mongodb|restapi|git|github|firebase|sql|html|css|javascript/.test(key)) return 2;
  if (belongsTo(groups.data) && /powerbi|microsoftexcel|sql|dataanalysis|figma|microsoftpowerpoint/.test(key)) return 2;
  if (belongsTo(groups.business) && /accounting|microsoftexcel|financialreporting|dataentry|powerbi/.test(key)) return 2;
  return 0;
};

const professionalUsefulness = (skill, major = "") => {
  const normalizedMajor = String(major || "").toLocaleLowerCase();
  const key = keyOf(skill);
  const ranks = normalizedMajor.includes("information systems") || normalizedMajor.includes("نظم المعلومات") || normalizedMajor.includes("data") || normalizedMajor.includes("تحليل")
    ? ["powerbi", "microsoftexcel", "dataanalysis", "sql", "figma", "microsoftpowerpoint"]
    : normalizedMajor.includes("account") || normalizedMajor.includes("محاسب") || normalizedMajor.includes("business") || normalizedMajor.includes("ادارة") || normalizedMajor.includes("إدارة")
      ? ["accounting", "microsoftexcel", "financialreporting", "dataentry"]
      : ["python", "reactjs", "nodejs", "mongodb", "restapi", "git", "github", "firebase", "figma"];
  const position = ranks.indexOf(key);
  return position === -1 ? 0 : ranks.length - position;
};

// Presentation-only ranking. verifiedSkills is never mutated; the returned
// list is a deterministic display subset of those verified source facts.
const rankResumeSkills = ({
  verifiedSkills = [],
  projectEvidence,
  experienceEvidence,
  evidence = {},
  major,
  academicTrack,
  personalInfo = {},
  opportunityKeywords = null,
  max = MAX_DISPLAY_SKILLS,
} = {}) => {
  const skills = normalizeResumeSkills(verifiedSkills);
  const projects = Array.isArray(projectEvidence) ? projectEvidence : (Array.isArray(evidence.projects) ? evidence.projects : []);
  const experiences = Array.isArray(experienceEvidence) ? experienceEvidence : (Array.isArray(evidence.experiences) ? evidence.experiences : []);
  const profile = {
    major: major ?? personalInfo.major ?? "",
    academicTrack: academicTrack ?? personalInfo.academicTrack ?? "",
    opportunityKeywords: opportunityKeywords || [],
  };
  const isStudent = /student|طالب|طالبة/iu.test(personalInfo.studentStatus || personalInfo.status || "");
  const isGraduate = /graduate|خريج|خريجة/iu.test(personalInfo.studentStatus || personalInfo.status || "");

  return skills
    .map((name) => {
      const projectMatches = projects.filter((entry) => skillAppearsIn(name, entry)).length;
      const experienceMatches = experiences.filter((entry) => skillAppearsIn(name, entry)).length;
      const explicitMatches = projectMatches + experienceMatches;
      const relevance = relevanceScore(name, profile);
      const evidenceStrength = explicitMatches > 0 ? "strong" : relevance > 0 ? "moderate" : "weak";
      const strengthScore = evidenceStrength === "strong" ? 300 : evidenceStrength === "moderate" ? 200 : 100;
      const sourceBoost = Math.min(explicitMatches, 3) * 12
        + (isStudent ? projectMatches * 5 : 0)
        + (isGraduate ? experienceMatches * 5 : 0);
      const score = strengthScore + sourceBoost + relevance * 10 + professionalUsefulness(name, profile.major);
      return {
        name,
        evidenceStrength,
        score,
        projectBacked: projectMatches > 0,
        experienceBacked: experienceMatches > 0,
      };
    })
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "en"))
    .slice(0, Math.max(0, max));
};

module.exports = { MAX_DISPLAY_SKILLS, rankResumeSkills };
