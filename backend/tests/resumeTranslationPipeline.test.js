const assert = require("assert");
const {
  MAX_RESUME_TRANSLATIONS,
  resumeTextTranslationSchema,
  validateResumeTranslationCoverage,
} = require("../services/resumeTranslationContract");
const {
  buildResumeTranslationUpdatePlan,
  collectResumeTextForTranslation,
  readTranslatedItemValue,
  translateResumeToEnglish,
} = require("../services/resumeAiService");
const {
  buildEnglishLocalizationApprovalUpdate,
  hashLocalizationSource,
} = require("../services/resumeLocalizationApproval");

const arabicPattern = /[\u0600-\u06FF]/;
const clone = (value) => JSON.parse(JSON.stringify(value));

const sourceResume = {
  personalInfo: {
    fullName: "طالبة تجريبية",
    studentStatus: "student",
    major: "نظم المعلومات الإدارية",
    university: "جامعة الملك سعود",
    degree: "بكالوريوس",
    city: "الرياض",
    academicTrack: "تحليل الأعمال",
  },
  summary: "طالبة لديها خبرة تطبيقية في تحليل البيانات.",
  education: [],
  experience: [{
    id: "experience-1",
    title: "متدربة",
    organization: "شركة الخدمات الرقمية",
    description: "أعددت تقارير أسبوعية.",
    achievements: [],
  }],
  projects: [{
    id: "project-1",
    title: "لوحة متابعة المبيعات",
    organization: "مشروع جامعي",
    description: "حللت بيانات المبيعات وعرضتها في لوحة مؤشرات.",
    achievements: [],
  }],
  certifications: [{
    id: "certification-1",
    title: "دورة تحليل البيانات",
    organization: "منصة التدريب",
    description: "دورة في أساسيات تحليل البيانات.",
    achievements: [],
  }],
  volunteering: [{
    id: "activity-1",
    title: "عضوة نادي نظم المعلومات",
    organization: "النادي الطلابي",
    description: "نظمت لقاءً تعريفيًا للطالبات.",
    achievements: [],
  }],
  skills: ["تحليل البيانات"],
  languages: [{ id: "language-1", name: "العربية", level: "اللغة الأم" }],
  settings: { language: "ar", direction: "rtl" },
};

const run = async () => {
  // CI smoke contract: valid, invalid, empty, and maximum-size responses.
  assert.deepStrictEqual(resumeTextTranslationSchema.parse({ translations: [] }), { translations: [] });
  assert.throws(() => resumeTextTranslationSchema.parse({ translations: [{ id: "", text: "English" }] }));
  const maxBatch = Array.from({ length: MAX_RESUME_TRANSLATIONS }, (_, index) => ({
    id: `field-${index}`,
    text: `Translation ${index}`,
  }));
  assert.strictEqual(
    resumeTextTranslationSchema.parse({ translations: maxBatch }).translations.length,
    MAX_RESUME_TRANSLATIONS,
  );

  const requestedItems = collectResumeTextForTranslation(sourceResume);
  const canonicalValues = [
    sourceResume.personalInfo.major,
    sourceResume.personalInfo.university,
    sourceResume.personalInfo.degree,
    sourceResume.personalInfo.city,
    sourceResume.personalInfo.academicTrack,
  ];
  assert.ok(
    requestedItems.every((item) => !canonicalValues.includes(item.text)),
    "canonical profile facts bypass free-text AI translation",
  );
  const brandResume = clone(sourceResume);
  brandResume.volunteering[0].organization = "دربك";
  assert.ok(
    collectResumeTextForTranslation(brandResume).every((item) => item.text !== "دربك"),
    "the Darbak brand bypasses AI translation",
  );

  let providerCalls = 0;
  let requestInput = "";
  const fakeClient = {
    responses: {
      parse: async (request) => {
        providerCalls += 1;
        requestInput = request.input;
        return {
          id: "mock-translation-response",
          model: "mock-terra",
          output_parsed: {
            translations: requestedItems.map((item, index) => ({
              id: item.id,
              text: item.id === "summary"
                ? "Management Information Systems student with hands-on data analysis experience."
                : `English display value ${index + 1}`,
            })),
          },
          usage: { input_tokens: 100, output_tokens: 100, total_tokens: 200 },
        };
      },
    },
  };
  const original = clone(sourceResume);
  const translated = await translateResumeToEnglish({
    resume: sourceResume,
    userKey: "translation-contract-test",
    clientOverride: fakeClient,
  });
  assert.strictEqual(providerCalls, 1, "the production translation path makes one provider call");
  assert.ok(!requestInput.includes(sourceResume.personalInfo.major), "canonical major is not sent to AI");
  assert.ok(!requestInput.includes(sourceResume.personalInfo.university), "canonical university is not sent to AI");
  requestedItems.forEach((item) => {
    const value = readTranslatedItemValue(translated.data, item);
    assert.ok(value && !arabicPattern.test(value), `${item.id} has an English display value`);
  });
  assert.deepStrictEqual(sourceResume, original, "English generation never mutates the Arabic master payload");

  assert.throws(
    () => validateResumeTranslationCoverage(requestedItems, {
      translations: requestedItems.slice(1).map((item) => ({ id: item.id, text: "English" })),
    }),
    (error) => error.code === "RESUME_TRANSLATION_RESPONSE_INCOMPLETE",
  );

  const firstPlan = buildResumeTranslationUpdatePlan({ resume: sourceResume });
  const savedEnglish = {
    ...translated.data,
    localizedDisplay: {
      ...(translated.data.localizedDisplay || {}),
      sourceHashes: firstPlan.sourceHashes,
    },
  };
  const unchangedPlan = buildResumeTranslationUpdatePlan({
    resume: sourceResume,
    existingEnglishResume: savedEnglish,
  });
  assert.strictEqual(unchangedPlan.changedItems.length, 0, "fresh translations are reused on refresh/open");

  const approvalSource = sourceResume.projects[0].title;
  const approvalHash = hashLocalizationSource(approvalSource);
  const versionBeforeApproval = {
    ...savedEnglish,
    localizedDisplay: {
      ...(savedEnglish.localizedDisplay || {}),
      sourceHashes: {
        ...(savedEnglish.localizedDisplay?.sourceHashes || {}),
        "projects:project-1:title": approvalHash,
      },
    },
  };
  const arabicBeforeApproval = clone(sourceResume);
  const approval = buildEnglishLocalizationApprovalUpdate({
    versionPayload: versionBeforeApproval,
    groupKey: "groups:projects:project-1",
    items: [{
      section: "projects",
      entryId: "project-1",
      field: "title",
      sourceText: approvalSource,
      targetText: "Sales Performance Dashboard",
    }],
  });
  assert.strictEqual(
    approval.set["resumePayload.localizedDisplay.entries.projects:project-1.title"],
    "Sales Performance Dashboard",
  );
  assert.strictEqual(
    approval.records["entries:projects:project-1:title"].approvedByUser,
    true,
  );
  assert.deepStrictEqual(sourceResume, arabicBeforeApproval, "approval is isolated from the Arabic Resume payload");

  const changedSource = clone(sourceResume);
  changedSource.projects[0].description = "حللت بيانات المبيعات وصممت لوحة مؤشرات تفاعلية.";
  const changedPlan = buildResumeTranslationUpdatePlan({
    resume: changedSource,
    existingEnglishResume: savedEnglish,
  });
  assert.deepStrictEqual(
    changedPlan.changedItems.map((item) => item.id),
    ["projects:project-1:description"],
    "only changed user-specific source text becomes stale",
  );

  let failedProviderCalls = 0;
  const failingClient = {
    responses: {
      parse: async () => {
        failedProviderCalls += 1;
        throw Object.assign(new Error("provider unavailable"), { status: 503 });
      },
    },
  };
  await assert.rejects(() => translateResumeToEnglish({
    resume: sourceResume,
    userKey: "translation-provider-failure-test",
    clientOverride: failingClient,
  }));
  assert.strictEqual(failedProviderCalls, 1);
  assert.deepStrictEqual(sourceResume, original, "provider failure leaves the Arabic master untouched");

  console.log("resume translation pipeline tests passed");
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
