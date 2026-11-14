// Shared by the React app and scripts/prerenderCompanyPages.js.
export const SITE_ORIGIN = "https://darbak.space";

// Pages prerendered at build time are written as <path>/index.html, and the
// static host only serves that file when the URL ends with "/". Their
// canonical URL must keep the trailing slash so search engines index the
// prerendered HTML instead of the empty SPA shell.
const PRERENDERED_PATH_PATTERNS = [
  /^\/companies\/[^/]+$/,
  /^\/experiences\/[a-f0-9]{24}$/i,
];

export const toCanonicalPath = (path = "/") => {
  const trimmedPath = path === "/" ? "/" : String(path || "/").replace(/\/+$/, "") || "/";
  return PRERENDERED_PATH_PATTERNS.some((pattern) => pattern.test(trimmedPath))
    ? `${trimmedPath}/`
    : trimmedPath;
};

export const toCanonicalUrl = (path = "/") => `${SITE_ORIGIN}${toCanonicalPath(path)}`;

const isUnclearText = (value = "") => {
  const letters = String(value || "").trim().match(/[A-Za-z؀-ۿ]/g) || [];
  return letters.length < 2;
};

export const getExperienceMajor = (experience = {}) =>
  isUnclearText(experience.major)
    ? experience.majorCategory || experience.major || ""
    : experience.major;

export const buildExperienceSeo = (experience = {}) => {
  const id = experience._id || experience.id || "";
  const organization = String(experience.organizationName || "").trim();
  const city = String(experience.city || "").trim();
  const major = String(getExperienceMajor(experience) || "").trim();

  return {
    title: String(experience.title || "").trim()
      || (organization ? `تجربة تدريب في ${organization}` : "تجربة تدريب تعاوني"),
    description: `تجربة تدريب في ${organization || "جهة تدريب"}${
      city ? ` بمدينة ${city}` : ""
    } لتخصص ${major || "طلاب التدريب التعاوني"} على منصة دربك.`,
    path: id ? `/experiences/${id}` : "/experiences",
    keywords: ["تجربة تدريب", "تدريب تعاوني", organization, city, major]
      .filter(Boolean)
      .join(", "),
  };
};
