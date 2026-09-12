const assert = require("assert");
const {
  applyProjectDescriptionAnswer,
  applyExperienceDescriptionAnswer,
  applyActivityDescriptionAnswer,
  buildEnrichmentQuestions,
  buildUserSourceEnrichmentFacts,
  getEnrichmentSourceSignature,
  getActivityEnrichmentStatus,
  getExperienceEnrichmentStatus,
  getProjectEnrichmentStatus,
  buildPendingProjectDescriptionQuestion,
  mergeStructuredAnswersIntoFacts,
  parseStructuredAnswerFieldKey,
  upsertAnswersByFieldKey,
  validateProjectDescriptionAnswer,
} = require("../services/resumeAgentAnswerLifecycle");

const fieldKey = "project_description:project-customer-satisfaction";
const validAnswer = "حللت استبيان رضا العملاء وصنفت أسباب عدم الرضا وعرضت النتائج في تقرير.";

assert.deepStrictEqual(parseStructuredAnswerFieldKey(fieldKey), {
  type: "project_description",
  itemId: "project-customer-satisfaction",
});
assert.strictEqual(validateProjectDescriptionAnswer(validAnswer).accepted, true);
assert.strictEqual(validateProjectDescriptionAnswer("مشروع جامعي").accepted, true);

const facts = {
  projects: [
    { id: "project-customer-satisfaction", title: "تحليل رضا العملاء", description: "" },
    { id: "project-other", title: "مشروع آخر", description: "حللت بيانات المشروع وقدمت النتائج في تقرير.", userSourceDescription: "حللت بيانات المشروع وقدمت النتائج في تقرير." },
  ],
};
const answers = [{ fieldKey, answer: validAnswer }];
const merged = mergeStructuredAnswersIntoFacts(facts, answers);
assert.strictEqual(merged.projects[0].description, validAnswer);
assert.strictEqual(merged.projects[1].description, "حللت بيانات المشروع وقدمت النتائج في تقرير.");

const persisted = JSON.parse(JSON.stringify(facts));
assert.strictEqual(applyProjectDescriptionAnswer(persisted, answers[0]), true);
assert.strictEqual(persisted.projects[0].description, validAnswer);
assert.strictEqual(persisted.projects[1].description, "حللت بيانات المشروع وقدمت النتائج في تقرير.");

const experienceFacts = { experiences: [{ id: "experience-1", title: "تدريب", description: "" }] };
const experienceAnswer = { fieldKey: "experience_description:experience-1", answer: "أعددت التقارير الأسبوعية ونظمت السجلات." };
assert.strictEqual(applyExperienceDescriptionAnswer(experienceFacts, experienceAnswer), true);
assert.strictEqual(experienceFacts.experiences[0].description, experienceAnswer.answer);
assert.strictEqual(experienceFacts.experiences[0].responsibilities[0].text, experienceAnswer.answer);
assert.strictEqual(mergeStructuredAnswersIntoFacts({ experiences: [{ id: "experience-1" }] }, [experienceAnswer]).experiences[0].description, experienceAnswer.answer);
const legacyExperience = { experiences: [{ id: "", title: "تدريب محاسبي", description: "" }] };
assert.strictEqual(applyExperienceDescriptionAnswer(legacyExperience, {
  fieldKey: "experience_description:portfolio-experience-0-تدريب محاسبي",
  answer: experienceAnswer.answer,
}), true);

const activityFacts = { volunteering: [{ id: "activity-1", title: "النادي التقني", description: "" }] };
const activityAnswer = { fieldKey: "activity_description:activity-1", answer: "نظمت لقاءات تعريفية للطلاب." };
assert.strictEqual(applyActivityDescriptionAnswer(activityFacts, activityAnswer), true);
assert.strictEqual(activityFacts.volunteering[0].description, activityAnswer.answer);
assert.strictEqual(activityFacts.volunteering[0].responsibilities[0].text, activityAnswer.answer);
assert.strictEqual(mergeStructuredAnswersIntoFacts({ volunteering: [{ id: "activity-1" }] }, [activityAnswer]).volunteering[0].description, activityAnswer.answer);

const legacyPortfolio = { projects: [{ id: "", title: "تحليل رضا العملاء", description: "" }] };
assert.strictEqual(applyProjectDescriptionAnswer(legacyPortfolio, {
  fieldKey: "project_description:portfolio-project-0-تحليل رضا العملاء",
  answer: validAnswer,
}), true);
assert.strictEqual(legacyPortfolio.projects[0].description, validAnswer);

const replaced = upsertAnswersByFieldKey(
  [{ fieldKey, answer: "مشروع جامعي" }],
  [{ fieldKey, answer: validAnswer }]
);
assert.strictEqual(replaced.length, 1);
assert.strictEqual(replaced[0].answer, validAnswer);

const pendingQuestion = buildPendingProjectDescriptionQuestion(facts, { answers: [] });
assert.strictEqual(pendingQuestion.fieldKey, fieldKey);
assert.strictEqual(pendingQuestion.inputType, "textarea");
assert.strictEqual(buildPendingProjectDescriptionQuestion(facts, { skippedFieldKeys: [fieldKey] }), null);
assert.strictEqual(buildPendingProjectDescriptionQuestion(merged, { answers }), null);

const rankedQuestions = buildEnrichmentQuestions({
  experiences: [{ id: "experience-1", title: "تدريب محاسبي" }],
  projects: [{ id: "project-1", title: "لوحة مبيعات" }],
  volunteering: [{ id: "activity-1", title: "النادي التقني" }],
}, {});
assert.deepStrictEqual(rankedQuestions.map((question) => question.fieldKey), [
  "experience_description:experience-1",
  "project_description:project-1",
]);
assert.ok(rankedQuestions.every((question) => question.questionType === "enrichment"));
assert.strictEqual(rankedQuestions.length, 2);
assert.strictEqual(buildEnrichmentQuestions({ projects: [{ id: "project-1", title: "لوحة مبيعات" }] }, {
  skippedFieldKeys: ["project_description:project-1"],
}).length, 0);

const highImpactQuestions = buildEnrichmentQuestions({
  projects: [
    { id: "project-1", title: "لوحة مبيعات", technologies: "Power BI" },
    { id: "project-2", title: "نظام حجوزات" },
  ],
  volunteering: [{ id: "activity-1", title: "النادي التقني" }],
}, {});
assert.deepStrictEqual(highImpactQuestions.map((question) => question.fieldKey), [
  "project_description:project-1",
  "project_description:project-2",
]);
assert.strictEqual(buildEnrichmentQuestions({
  experiences: [{ id: "experience-complete", title: "تدريب", responsibilities: [{ id: "r1", text: "إعداد التقارير" }] }],
  projects: [{ id: "project-complete", title: "لوحة", description: "حللت بيانات المبيعات وبنيت لوحة متابعة.", userSourceDescription: "حللت بيانات المبيعات وبنيت لوحة متابعة." }],
}, {}).length, 0);

const businessStudentQuestions = buildEnrichmentQuestions({
  personalInfo: {
    major: "إدارة الأعمال",
    studentStatus: "student",
    university: "جامعة جدة",
    expectedGraduationYear: "",
    gpa: "",
    academicTrack: "",
  },
  projects: [{ id: "customer-satisfaction", title: "تحليل رضا العملاء", description: "مشروع جامعي" }],
  certifications: [{ id: "cert-1", title: "أساسيات إدارة المشاريع", organization: "", period: "" }],
  volunteering: [{ id: "club-1", title: "النادي الطلابي", description: "" }],
}, {});
assert.deepStrictEqual(businessStudentQuestions.map((question) => question.fieldKey), [
  "project_description:customer-satisfaction",
]);
assert.strictEqual(businessStudentQuestions[0].whyNeeded, "ركز على الخطوات اللي نفذتها بنفسك، وإذا استخدمت أداة معينة اذكرها.");

const activityOnlyQuestions = buildEnrichmentQuestions({
  projects: [{ id: "project-complete", title: "تحليل رضا العملاء", description: "حللت الاستبيان وصنفت أسباب عدم الرضا.", userSourceDescription: "حللت الاستبيان وصنفت أسباب عدم الرضا." }],
  volunteering: [{ id: "club-1", title: "النادي الطلابي", description: "" }],
}, {});
assert.deepStrictEqual(activityOnlyQuestions.map((question) => question.fieldKey), ["activity_description:club-1"]);

const pollutedPresentationFacts = buildUserSourceEnrichmentFacts({
  projects: [{
    id: "customer-satisfaction",
    title: "تحليل رضا العملاء",
    description: "تتبع سلوك العملاء ومراجعة تقييمات المنتجات.",
    achievements: [{ id: "ai-project-1-bullet-1", text: "حلل مؤشرات رضا العملاء وحدد فرص التحسين." }],
  }],
  volunteering: [{
    id: "club-1",
    title: "النادي الطلابي",
    userSourceDescription: "نظمت لقاءات النادي ونسقت تسجيل الحضور.",
  }],
}, {
  projects: [{
    id: "customer-satisfaction",
    title: "تحليل رضا العملاء",
    userSourceDescription: "مشروع جامعي",
  }],
});
const pollutionQuestions = buildEnrichmentQuestions(pollutedPresentationFacts, {});
assert.deepStrictEqual(pollutionQuestions.map((question) => question.fieldKey), [
  "project_description:customer-satisfaction",
]);
assert.strictEqual(pollutedPresentationFacts.projects[0].generatedPresentationExists, true);

const explicitProjectAnswer = "حللت استبيان رضا العملاء وصنفت أسباب عدم الرضا وعرضت النتائج في تقرير.";
const answeredPollutedFacts = mergeStructuredAnswersIntoFacts(pollutedPresentationFacts, [{
  fieldKey: "project_description:customer-satisfaction",
  answer: explicitProjectAnswer,
}]);
assert.strictEqual(answeredPollutedFacts.projects[0].userSourceDescription, explicitProjectAnswer);
assert.strictEqual(buildEnrichmentQuestions(answeredPollutedFacts, {}).some((question) => question.fieldKey === "project_description:customer-satisfaction"), false);

const clubWithoutContribution = {
  id: "entrepreneurship-club",
  title: "عضو في نادي ريادة الأعمال",
  userSourceDescription: "",
  userSourceContributions: [],
};
const clubFieldKey = "activity_description:entrepreneurship-club";
const clubSourceSignature = getEnrichmentSourceSignature(clubWithoutContribution);
const persistedSkippedState = {
  enrichmentStates: {
    [clubFieldKey]: { status: "skipped", sourceSignature: clubSourceSignature },
  },
};
assert.strictEqual(buildEnrichmentQuestions({
  volunteering: [clubWithoutContribution],
  skills: ["Microsoft Excel"],
}, persistedSkippedState).length, 0);
assert.strictEqual(buildEnrichmentQuestions({
  volunteering: [clubWithoutContribution],
  skills: ["Microsoft Excel", "Power BI"],
}, persistedSkippedState).length, 0);
assert.deepStrictEqual(buildEnrichmentQuestions({
  volunteering: [{ ...clubWithoutContribution, title: "قائد فريق نادي ريادة الأعمال" }],
}, persistedSkippedState).map((question) => question.fieldKey), [clubFieldKey]);

const projectWithTasksInAlternateField = buildUserSourceEnrichmentFacts({
  projects: [{
    id: "customer-satisfaction-with-tasks",
    title: "تحليل رضا العملاء",
    userSourceDescription: "مشروع جامعي",
    tasks: ["حللت نتائج الاستبيان", "صنفت أسباب عدم الرضا"],
    achievements: [{ id: "ai-project-1-bullet-1", text: "صياغة أنشأها الوكيل" }],
  }],
  volunteering: [{ id: "club-needs-detail", title: "النادي الطلابي" }],
}, {});
assert.deepStrictEqual(getProjectEnrichmentStatus(projectWithTasksInAlternateField.projects[0]), {
  complete: true,
  missing: [],
  hasMeaningfulUserDetail: true,
  fieldsDetected: ["contributions"],
});
assert.deepStrictEqual(buildEnrichmentQuestions(projectWithTasksInAlternateField, {}).map((question) => question.fieldKey), [
  "activity_description:club-needs-detail",
]);
assert.strictEqual(getExperienceEnrichmentStatus({ userSourceContributions: ["إعداد التقارير الأسبوعية"] }).complete, true);
assert.strictEqual(getActivityEnrichmentStatus({ userSourceDescription: "نادي طلابي" }).complete, false);

console.log("resumeAgentAnswerLifecycle tests passed");
