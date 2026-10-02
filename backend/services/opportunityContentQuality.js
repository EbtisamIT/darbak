const { text } = require("./opportunityDiscovery/extract");

// Remove employer branding, not facts inferred from a job title. Keep rawContent
// intact so a reviewer can inspect the exact original advert.
const BRANDING = /for over (?:\w+[ -]?){1,5}(?:years|decades)|(?:global|world|market)[ -]leader|partner and creator of luxury|portfolio of over|our (?:journey|culture|values|mission)|finest brands|fun and supportive environment|empowered to innovate|we (?:are always looking|celebrate diversity|offer competitive)|equal opportunity employer|what we can offer|منذ أكثر من|شركة رائدة|رائدة عالميا|ثقافة الشركة|قيمنا|رؤيتنا|بيئة عمل محفزة|تكافؤ الفرص/i;
const ROLE_ACTION = /\b(?:support(?:s|ing)?|assist(?:s|ing)?|develop(?:s|ing)?|analy[sz](?:e|es|ing)|prepare|manage|coordinate|conduct|maintain|handle|handling|implement|design|monitor|review|research|report|responsible for)\b|إعداد|تحليل|تنسيق|متابعة|مساعدة|دعم|تطوير|تصميم|تنفيذ|إدارة/i;
const TRAINING = /intern|trainee|co[ -]?op|training|student|متدرب|تدريب|طلاب/i;
const GENERIC = /make a real impact|up[ -]skill|innovate your career|wide range of backgrounds|valued member of the team|learn and grow|تطوير مهاراتك|بناء مستقبلك/i;
const sentences = (value) => text(value || "").split(/\n+|(?<=[.!?؟])\s+/).map((line) => line.trim()).filter(Boolean);
function isBoilerplate(value) { return BRANDING.test(value) || GENERIC.test(value) && !ROLE_ACTION.test(value); }
function cleanOpportunityContent(job) {
  const removed = [];
  const clean = (values, field) => [...new Set((values || []).flatMap((value) => {
    const parts = sentences(value);
    const kept = parts.filter((part) => {
      if (!isBoilerplate(part)) return true;
      removed.push({ field, text: part }); return false;
    });
    return kept.length ? [kept.join(" ")] : [];
  }))];
  const responsibilities = clean(job.responsibilities, "responsibilities");
  const requirements = clean(job.requirements, "requirements");
  const overview = sentences(job.description).filter((part) => !isBoilerplate(part) &&
    TRAINING.test(part) && ROLE_ACTION.test(part));
  const roleText = overview.length ? overview : responsibilities.flatMap(sentences).filter((part) => ROLE_ACTION.test(part));
  // A title-only description is deliberately modest when the advert has no
  // role-specific overview; never invent duties or use eligibility as duties.
  const description = (roleText.slice(0, 2).join(" ") || text(job.title)).slice(0, 450);
  return { responsibilities, requirements, description,
    contentQualityWarning: removed.some((item) => item.field === "responsibilities"), removed };
}
module.exports = { cleanOpportunityContent, isBoilerplate };
