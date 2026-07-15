const SITE_NAME = "منصة دربك";
const SITE_ORIGIN = "https://darbak.space";

const setMetaAttribute = (selector, attribute, value) => {
  if (typeof document === "undefined" || !value) return;
  const element = document.querySelector(selector);
  if (element) element.setAttribute(attribute, value);
};

const setMetaContent = (selector, value) =>
  setMetaAttribute(selector, "content", value);

export const setPageSeo = ({
  title,
  description,
  path = "/",
  keywords = "",
} = {}) => {
  if (typeof document === "undefined") return;

  const normalizedPath = path === "/" ? "/" : path.replace(/\/+$/, "");
  const canonicalUrl = `${SITE_ORIGIN}${normalizedPath}`;
  const pageTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;

  document.title = pageTitle;

  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[name="keywords"]', keywords);
  setMetaAttribute('link[rel="canonical"]', "href", canonicalUrl);
  setMetaContent('meta[property="og:title"]', pageTitle);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[property="og:url"]', canonicalUrl);
  setMetaContent('meta[name="twitter:title"]', pageTitle);
  setMetaContent('meta[name="twitter:description"]', description);
};

export const buildExperiencesSeoMeta = ({ city = "", specialty = "", path = "/experiences" }) => {
  const target = [specialty, city].filter(Boolean).join(" في ");
  const title = target
    ? `تجارب تدريب ${target}`
    : "تجارب التدريب التعاوني للطلاب";
  const description = target
    ? `استعرض تجارب تدريب ${target} من طلاب سابقين في منصة دربك، مع تقييمات وملاحظات عن الجهات والبيئة والمكافآت وطريقة الاستفادة من التجارب.`
    : "استعرض تجارب التدريب التعاوني للطلاب والطالبات في السعودية حسب التخصص والمدينة والجهة، وشارك تجربتك ليستفيد غيرك.";

  return {
    title,
    description,
    path,
    keywords: [
      "تجارب تدريب",
      "تدريب تعاوني",
      specialty,
      city,
      `تدريب ${city}`.trim(),
      `تجارب تدريب ${specialty}`.trim(),
    ]
      .filter(Boolean)
      .join(", "),
  };
};

export const buildTrainingFinderSeoMeta = ({
  city = "",
  specialty = "",
  path = "/where-to-train",
}) => {
  const target = [specialty, city].filter(Boolean).join(" في ");
  const title = target ? `وين أتدرب؟ جهات تدريب ${target}` : "وين أتدرب؟";
  const description = target
    ? `اكتشف جهات وفرص تدريب مناسبة لتخصص ${specialty || "طلاب التدريب"}${
        city ? ` في ${city}` : ""
      } بناءً على تجارب دربك واقتراحات منظمة تساعدك تبدأ البحث.`
    : "اختر تخصصك ومدينتك في دربك وشاهد جهات تدريب وفرص مقترحة وتجارب طلاب سابقة تساعدك تبدأ التقديم بثقة.";

  return {
    title,
    description,
    path,
    keywords: [
      "وين أتدرب",
      "جهات تدريب",
      "فرص تدريب",
      "تدريب تعاوني",
      specialty,
      city,
      `تدريب ${city}`.trim(),
      `جهات تدريب ${specialty}`.trim(),
    ]
      .filter(Boolean)
      .join(", "),
  };
};
