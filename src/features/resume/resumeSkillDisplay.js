const SKILL_ALIASES = {
  "git hub": "GitHub",
  github: "GitHub",
  react: "React.js",
  reactjs: "React.js",
  "react.js": "React.js",
  "react js": "React.js",
  "ui/ ux": "UI/UX",
  "ui / ux": "UI/UX",
  "ui/ux": "UI/UX",
  firebase: "Firebase",
  figma: "Figma",
  "node.js": "Node.js",
  node: "Node.js",
  nodejs: "Node.js",
  "node js": "Node.js",
  "power bi": "Power BI",
  "microsoft excel": "Microsoft Excel",
  excel: "Microsoft Excel",
  sql: "SQL",
  "web design": "Web Design",
  "software development": "Software Development",
};

const normalizeKey = (value = "") => String(value || "")
  .trim()
  .replace(/\s*\/\s*/g, "/")
  .replace(/\s+/g, " ")
  .toLocaleLowerCase();

const canonicalSkill = (value = "") => {
  const clean = String(value || "").trim().replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ");
  return SKILL_ALIASES[normalizeKey(clean)] || clean;
};

export const normalizeDisplaySkills = (skills = []) => {
  const normalized = (Array.isArray(skills) ? skills : [])
    .flatMap((skill) => String(typeof skill === "string" ? skill : skill?.name || "").split(/[•|,،]/))
    .map(canonicalSkill)
    .filter(Boolean);
  const hasUi = normalized.some((skill) => normalizeKey(skill) === "ui");
  const hasUx = normalized.some((skill) => normalizeKey(skill) === "ux");
  const candidates = hasUi && hasUx
    ? [...normalized.filter((skill) => !["ui", "ux"].includes(normalizeKey(skill))), "UI/UX"]
    : normalized;
  const seen = new Set();
  return candidates.filter((skill) => {
    const key = normalizeKey(skill).replace(/[^\p{L}\p{N}]/gu, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const compactKey = (value = "") => normalizeKey(value)
  .replace(/react\.?(?:\s*js)?/gu, "reactjs")
  .replace(/node\.?(?:\s*js)?/gu, "nodejs")
  .replace(/rest\s*apis?/gu, "restapi")
  .replace(/[^\p{L}\p{N}]/gu, "");

const entryText = (entry = {}) => [
  entry.title,
  entry.name,
  entry.description,
  entry.details,
  ...(entry.tools || []),
  ...(entry.technologies || []),
  ...(entry.skills || []),
  ...(entry.responsibilities || []).map((item) => item?.text || item),
  ...(entry.achievements || []).map((item) => item?.text || item?.html || item),
].filter(Boolean).join(" ").toLocaleLowerCase();

const evidenceAliases = {
  microsoftexcel: ["microsoft excel", "excel"],
  powerbi: ["power bi", "powerbi"],
  reactjs: ["react.js", "react js", "reactjs", "react"],
  nodejs: ["node.js", "node js", "nodejs"],
  dataanalysis: ["data analysis", "تحليل البيانات"],
  uiux: ["ui/ux", "ui", "ux", "واجهات", "تجربة المستخدم"],
  softwaredevelopment: ["software development", "تطوير برمجيات", "تطوير البرمجيات"],
  webdesign: ["web design", "تصميم الويب"],
};

const appearsIn = (skill, entry) => {
  const text = entryText(entry);
  const aliases = evidenceAliases[compactKey(skill)] || [normalizeKey(skill)];
  return aliases.some((alias) => text.includes(alias));
};

const relevance = (skill, major = "", track = "") => {
  const context = `${major} ${track}`.toLocaleLowerCase();
  const key = compactKey(skill);
  if (/(computer|حاسب|تقنية|software|برمج)/u.test(context) && /(softwaredevelopment|webdesign|uiux|figma|python|reactjs|nodejs|mongodb|restapi|git|github|firebase|sql)/.test(key)) return 2;
  if (/(data|analytics|تحليل|information systems|نظم المعلومات)/u.test(context) && /(powerbi|microsoftexcel|sql|dataanalysis|figma|uiux)/.test(key)) return 2;
  if (/(business|accounting|إدارة|ادارة|محاسب|finance|مالي)/u.test(context) && /(accounting|microsoftexcel|financialreporting|dataentry|powerbi)/.test(key)) return 2;
  return 0;
};

const usefulness = (skill, major = "") => {
  const context = String(major || "").toLocaleLowerCase();
  const key = compactKey(skill);
  const order = /information systems|نظم المعلومات|data|تحليل/u.test(context)
    ? ["powerbi", "microsoftexcel", "dataanalysis", "sql", "figma", "uiux"]
    : /account|محاسب|business|ادارة|إدارة/u.test(context)
      ? ["accounting", "microsoftexcel", "financialreporting", "dataentry"]
      : ["softwaredevelopment", "uiux", "webdesign", "figma", "python", "reactjs", "nodejs", "mongodb", "restapi", "git", "github", "firebase", "microsoftexcel"];
  const index = order.indexOf(key);
  return index < 0 ? 0 : order.length - index;
};

export const rankResumeSkills = ({ verifiedSkills = [], projects = [], experiences = [], personalInfo = {}, max = 10 } = {}) =>
  normalizeDisplaySkills(verifiedSkills)
    .map((name) => {
      const projectMatches = projects.filter((entry) => appearsIn(name, entry)).length;
      const experienceMatches = experiences.filter((entry) => appearsIn(name, entry)).length;
      const explicitMatches = projectMatches + experienceMatches;
      const related = relevance(name, personalInfo.major, personalInfo.academicTrack);
      const strength = explicitMatches ? 300 : related ? 200 : 100;
      return {
        name,
        score: strength + Math.min(explicitMatches, 3) * 12 + related * 10 + usefulness(name, personalInfo.major),
      };
    })
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "en"))
    .slice(0, Math.max(0, max))
    .map(({ name }) => name);

export const getResumeDisplaySkills = (resume = {}, skills = null) => {
  const facts = resume.verifiedResumeFacts || {};
  const verifiedSkills = skills || facts.skills || resume.skills || [];
  return rankResumeSkills({
    verifiedSkills,
    projects: facts.projects || resume.projects || [],
    experiences: facts.experiences || resume.experiences || resume.experience || [],
    personalInfo: facts.personalInfo || resume.personalInfo || {},
  });
};
