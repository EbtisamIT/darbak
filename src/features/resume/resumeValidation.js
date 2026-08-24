import {
  getVisibleSectionOrder,
  hasEntryContent,
  stripHtml,
} from "./resumeDefaults";

const isValidEmail = (value = "") =>
  !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.toString().trim());

export const estimateResumePages = (resume = {}) => {
  const visibleSections = getVisibleSectionOrder(resume);
  const densityFactor = resume.settings?.density === "compact" ? 0.82 : 1;
  const fontFactor =
    resume.settings?.fontSize === "large"
      ? 1.18
      : resume.settings?.fontSize === "small"
      ? 0.9
      : 1;

  let score = 18;
  score += (resume.summary || "").length / 8;
  score += (resume.skills || []).length * 2;
  score += (resume.languages || []).length * 4;

  ["education", "experience", "projects", "certifications", "volunteering"].forEach(
    (section) => {
      if (!visibleSections.includes(section)) return;
      (resume[section] || []).filter(hasEntryContent).forEach((entry) => {
        score += 14;
        score += (entry.description || entry.details || "").length / 12;
        score += (entry.achievements || []).reduce(
          (total, achievement) =>
            total + (achievement.text || stripHtml(achievement.html)).length / 10 + 5,
          0
        );
      });
    }
  );

  const pageCapacity = 118 / densityFactor / fontFactor;
  return Math.max(1, Math.ceil(score / pageCapacity));
};

export const getResumeCompletionItems = (resume = {}) => {
  const personal = resume.personalInfo || {};
  const visibleSections = getVisibleSectionOrder(resume);
  const summaryLength = (resume.summary || "").trim().length;
  const nonEmptyProjects = (resume.projects || []).filter(hasEntryContent);
  const nonEmptyExperience = (resume.experience || resume.experiences || []).filter(
    hasEntryContent
  );
  const nonEmptyEducation = (resume.education || []).filter(hasEntryContent);
  const skills = (resume.skills || []).map((skill) => skill.trim()).filter(Boolean);
  const duplicatedSkills = skills.filter(
    (skill, index) =>
      skills.findIndex((item) => item.toLowerCase() === skill.toLowerCase()) !== index
  );
  const missingDates = [
    ...(resume.education || []),
    ...(resume.experience || []),
    ...(resume.projects || []),
    ...(resume.certifications || []),
    ...(resume.volunteering || []),
  ].filter((entry) => hasEntryContent(entry) && !entry.period && !entry.startDate);
  const emptyVisibleSections = visibleSections.filter((section) => {
    if (section === "summary") return !summaryLength;
    if (section === "skills") return !skills.length;
    if (section === "languages") return !(resume.languages || []).some((language) => language.name);
    return !(resume[section] || []).some(hasEntryContent);
  });
  const estimatedPages = estimateResumePages(resume);

  return [
    {
      status: personal.fullName ? "complete" : "missing",
      title: "الاسم",
      detail: personal.fullName ? "موجود في رأس السيرة." : "أضف اسمك الكامل.",
    },
    {
      status: isValidEmail(personal.email) && personal.email ? "complete" : "missing",
      title: "البريد الإلكتروني",
      detail:
        isValidEmail(personal.email) && personal.email
          ? "البريد واضح وقابل للتواصل."
          : "أضف بريدًا صحيحًا للتواصل الرسمي.",
    },
    {
      status: personal.phone ? "complete" : "missing",
      title: "رقم التواصل",
      detail: personal.phone ? "رقم التواصل موجود." : "أضف رقمًا مختصرًا وواضحًا.",
    },
    {
      status: personal.major || personal.headline ? "complete" : "missing",
      title: "التخصص أو المسمى",
      detail: personal.major || personal.headline ? "واضح في أعلى السيرة." : "أضف تخصصك أو مسماك.",
    },
    {
      status: summaryLength >= 70 && summaryLength <= 420 ? "complete" : "improve",
      title: "النبذة المهنية",
      detail:
        summaryLength === 0
          ? "اكتب نبذة قصيرة من 3 إلى 4 أسطر."
          : summaryLength > 420
          ? "النبذة طويلة؛ اختصرها لتكون أسرع قراءة."
          : summaryLength < 70
          ? "النبذة موجودة لكن تحتاج تفاصيل أكثر."
          : "طول النبذة مناسب.",
    },
    {
      status: nonEmptyEducation.length ? "complete" : "missing",
      title: "التعليم",
      detail: nonEmptyEducation.length ? "تم إضافة التعليم." : "أضف الجامعة والمؤهل.",
    },
    {
      status: nonEmptyExperience.length || nonEmptyProjects.length ? "complete" : "missing",
      title: "خبرة أو مشروع واحد على الأقل",
      detail:
        nonEmptyExperience.length || nonEmptyProjects.length
          ? "يوجد ما يوضح خبرتك العملية."
          : "أضف مشروعًا جامعيًا أو تجربة عملية واحدة على الأقل.",
    },
    {
      status: skills.length >= 4 ? "complete" : "missing",
      title: "المهارات",
      detail: skills.length >= 4 ? "المهارات كافية كبداية." : "أضف 4 مهارات مرتبطة بتخصصك على الأقل.",
    },
    {
      status: missingDates.length ? "improve" : "complete",
      title: "التواريخ",
      detail: missingDates.length
        ? "بعض العناصر لا تحتوي تاريخًا؛ أضف الفترة إن كانت مهمة."
        : "التواريخ مرتبة.",
    },
    {
      status: emptyVisibleSections.length ? "improve" : "complete",
      title: "الأقسام الفارغة",
      detail: emptyVisibleSections.length
        ? "أخفِ الأقسام التي لا تحتاجها حتى لا تظهر فارغة."
        : "الأقسام الظاهرة تحتوي بيانات.",
    },
    {
      status: duplicatedSkills.length ? "improve" : "complete",
      title: "تكرار المهارات",
      detail: duplicatedSkills.length
        ? "احذف المهارات المتكررة حتى تبقى السيرة نظيفة."
        : "لا يوجد تكرار واضح في المهارات.",
    },
    {
      status: estimatedPages > 2 ? "improve" : "complete",
      title: "عدد الصفحات",
      detail:
        estimatedPages > 2
          ? "سيرتك تجاوزت صفحتين، جرّب اختصار بعض المحتوى."
          : `السيرة تبدو ضمن ${estimatedPages} صفحة تقريبًا.`,
    },
  ];
};
