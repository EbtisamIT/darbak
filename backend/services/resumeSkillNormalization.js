const SKILL_ALIASES = {
  "git hub": "GitHub",
  github: "GitHub",
  react: "React.js",
  "react.js": "React.js",
  "react js": "React.js",
  "ui/ ux": "UI/UX",
  "ui / ux": "UI/UX",
  "ui/ux": "UI/UX",
  "time managmaet": "Time Management",
  "time management": "Time Management",
  "microsoft powerpointb": "Microsoft PowerPoint",
  "microsoft powerpoint": "Microsoft PowerPoint",
};

const normalizeKey = (value = "") =>
  value
    .toString()
    .trim()
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .toLowerCase();

const normalizeResumeSkill = (value = "") => {
  const clean = value.toString().trim().replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ");
  return SKILL_ALIASES[normalizeKey(clean)] || clean;
};

const normalizeResumeSkills = (skills = [], max = 30) => {
  const seen = new Set();
  return (Array.isArray(skills) ? skills : [])
    .flatMap((skill) => String(typeof skill === "string" ? skill : skill?.name || "").split(/[•|,،]/))
    .map(normalizeResumeSkill)
    .filter((skill) => {
      const key = normalizeKey(skill).replace(/[^\p{L}\p{N}]/gu, "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
};

module.exports = { normalizeResumeSkill, normalizeResumeSkills };
