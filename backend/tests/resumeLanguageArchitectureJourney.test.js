const assert = require("assert");
const {
  getResumeSourceFacts,
  getArabicMasterPresentation,
  getEnglishPresentation,
} = require("../services/resumeArchitecture");
const {
  composeResumePreview,
} = require("../services/resumePortfolioHydration");
const {
  buildResumeTranslationUpdatePlan,
  readTranslatedItemValue,
  translateResumeToEnglish,
} = require("../services/resumeAiService");
const {
  buildEnglishLocalizationApprovalUpdate,
  hashLocalizationSource,
} = require("../services/resumeLocalizationApproval");

const clone = (value) => JSON.parse(JSON.stringify(value));
const hasArabic = (value = "") => /[\u0600-\u06FF]/u.test(String(value || ""));

const arabicMaster = {
  workflow: { factsOwner: "resume" },
  personalInfo: {
    fullName: "طالبة تجريبية",
    englishName: "Test Student",
    email: "student@example.test",
    phone: "0500000000",
    city: "الرياض",
    major: "نظم المعلومات الإدارية",
    university: "جامعة الملك سعود",
    degree: "بكالوريوس",
    studentStatus: "student",
  },
  summary: "طالبة نظم معلومات إدارية لديها خبرة تطبيقية في تحليل البيانات.",
  education: [{ id: "education-1", title: "بكالوريوس", organization: "جامعة الملك سعود" }],
  experiences: [{
    id: "experience-1",
    title: "متدربة تحليل أعمال",
    organization: "شركة تجريبية",
    userSourceDescription: "أعددت تقارير أسبوعية.",
    description: "إعداد التقارير الأسبوعية لدعم متابعة الأعمال.",
    achievements: [{ id: "experience-bullet-1", text: "أعددت التقارير الأسبوعية." }],
  }],
  projects: [{
    id: "project-1",
    title: "لوحة متابعة المبيعات",
    userSourceDescription: "حللت بيانات المبيعات.",
    description: "تحليل بيانات المبيعات وعرضها في لوحة مؤشرات.",
    achievements: [{ id: "project-bullet-1", text: "حللت بيانات المبيعات." }],
  }],
  volunteering: [{
    id: "activity-1",
    title: "عضوة نادي نظم المعلومات",
    organization: "النادي الطلابي",
    userSourceDescription: "نظمت لقاءً تعريفيًا.",
    description: "تنظيم لقاء تعريفي للطالبات.",
    achievements: [{ id: "activity-bullet-1", text: "نظمت لقاءً تعريفيًا." }],
  }],
  certifications: [{ id: "certification-1", title: "دورة تحليل البيانات", organization: "منصة تدريب" }],
  skills: ["Power BI", "Figma"],
  languages: [{ id: "language-1", name: "العربية", level: "اللغة الأم" }],
  settings: { language: "ar", direction: "rtl" },
};

const run = async () => {
  const masterBeforeEnglish = clone(arabicMaster);
  const arabicPreview = composeResumePreview({ language: "ar", resume: arabicMaster });
  assert.strictEqual(arabicPreview.summary, arabicMaster.summary);
  assert.deepStrictEqual(getResumeSourceFacts(arabicMaster).skills, ["Power BI", "Figma"]);

  const plan = buildResumeTranslationUpdatePlan({ resume: arabicPreview });
  let providerCalls = 0;
  const client = {
    responses: {
      parse: async () => ({
        id: `language-journey-${++providerCalls}`,
        model: "mock-terra",
        output_parsed: {
          translations: plan.changedItems.map((item, index) => ({
            id: item.id,
            text: item.id === "summary"
              ? "Management Information Systems student with practical data analysis experience."
              : `English presentation ${index + 1}`,
          })),
        },
        usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
      }),
    },
  };
  const translated = await translateResumeToEnglish({
    resume: arabicPreview,
    userKey: "language-architecture-journey",
    translationItems: plan.changedItems,
    clientOverride: client,
  });
  const englishPayload = {
    ...translated.data,
    localizedDisplay: {
      ...(translated.data.localizedDisplay || {}),
      sourceHashes: plan.sourceHashes,
    },
  };
  const englishPreview = composeResumePreview({
    language: "en",
    localizedVersion: true,
    masterResume: arabicMaster,
    englishVersionPayload: englishPayload,
  });
  assert.strictEqual(englishPreview.projects.length, arabicMaster.projects.length);
  assert.strictEqual(englishPreview.experiences.length, arabicMaster.experiences.length);
  assert.strictEqual(englishPreview.volunteering.length, arabicMaster.volunteering.length);
  plan.items.forEach((item) => {
    const display = readTranslatedItemValue(englishPayload, item);
    assert.ok(display && !hasArabic(display), `${item.id} has a complete English presentation`);
  });
  assert.deepStrictEqual(arabicMaster, masterBeforeEnglish, "English generation/open cannot mutate Arabic Master");
  assert.strictEqual(getEnglishPresentation(englishPayload).summary, englishPayload.summary);
  assert.strictEqual(getArabicMasterPresentation(arabicMaster).summary, arabicMaster.summary);

  // Open the Arabic form, change source membership and one Arabic activity,
  // then recompose. Old English skills cannot win over this source set.
  const editedMaster = clone(arabicMaster);
  editedMaster.skills = ["Power BI", "SQL"];
  editedMaster.volunteering[0].userSourceDescription = "نظمت لقاءين تعريفيين.";
  editedMaster.volunteering[0].description = "تنظيم لقاءين تعريفيين للطالبات.";
  const editedArabicPreview = composeResumePreview({ language: "ar", resume: editedMaster });
  assert.deepStrictEqual(editedArabicPreview.skills, ["Power BI", "SQL"]);
  const editedEnglishPreview = composeResumePreview({
    language: "en",
    localizedVersion: true,
    masterResume: editedMaster,
    englishVersionPayload: englishPayload,
  });
  assert.deepStrictEqual(editedEnglishPreview.skills, ["Power BI", "SQL"]);

  const updatePlan = buildResumeTranslationUpdatePlan({
    resume: editedArabicPreview,
    existingEnglishResume: englishPayload,
  });
  assert.ok(updatePlan.changedItems.some((item) => item.id === "skills:1"));
  assert.ok(updatePlan.changedItems.some((item) => item.id === "volunteering:activity-1:description"));
  assert.ok(updatePlan.reusedItems.some((item) => item.id === "projects:project-1:title"));

  const projectTitle = arabicMaster.projects[0].title;
  const approval = buildEnglishLocalizationApprovalUpdate({
    versionPayload: englishPayload,
    groupKey: "groups:projects:project-1",
    items: [{
      section: "projects",
      entryId: "project-1",
      field: "title",
      sourceText: projectTitle,
      targetText: "Sales Performance Dashboard",
    }],
  });
  const record = approval.records["entries:projects:project-1:title"];
  assert.strictEqual(record.status, "approved");
  assert.strictEqual(record.sourceHash, hashLocalizationSource(projectTitle));
  assert.strictEqual(record.approvedByUser, true);
  assert.deepStrictEqual(arabicMaster, masterBeforeEnglish, "English review cannot mutate Arabic facts/presentation");

  const changedProjectMaster = clone(arabicMaster);
  changedProjectMaster.projects[0].description = "تحليل بيانات المبيعات والفروع وعرضها في لوحة مؤشرات.";
  const changedProjectPlan = buildResumeTranslationUpdatePlan({
    resume: changedProjectMaster,
    existingEnglishResume: englishPayload,
  });
  assert.deepStrictEqual(
    changedProjectPlan.changedItems.map((item) => item.id),
    ["projects:project-1:description"],
    "only the materially changed Arabic item becomes stale",
  );
  assert.strictEqual(
    changedProjectPlan.resume.summary,
    englishPayload.summary,
    "last valid unchanged English content remains visible",
  );

  console.log("resume language architecture journey tests passed");
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
