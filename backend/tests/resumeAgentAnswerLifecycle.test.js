const assert = require("assert");
const {
  applyProjectDescriptionAnswer,
  applyExperienceDescriptionAnswer,
  applyActivityDescriptionAnswer,
  buildEnrichmentQuestions,
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
    { id: "project-other", title: "مشروع آخر", description: "وصف محفوظ" },
  ],
};
const answers = [{ fieldKey, answer: validAnswer }];
const merged = mergeStructuredAnswersIntoFacts(facts, answers);
assert.strictEqual(merged.projects[0].description, validAnswer);
assert.strictEqual(merged.projects[1].description, "وصف محفوظ");

const persisted = JSON.parse(JSON.stringify(facts));
assert.strictEqual(applyProjectDescriptionAnswer(persisted, answers[0]), true);
assert.strictEqual(persisted.projects[0].description, validAnswer);
assert.strictEqual(persisted.projects[1].description, "وصف محفوظ");

const experienceFacts = { experiences: [{ id: "experience-1", title: "تدريب", description: "" }] };
const experienceAnswer = { fieldKey: "experience_description:experience-1", answer: "أعددت التقارير الأسبوعية ونظمت السجلات." };
assert.strictEqual(applyExperienceDescriptionAnswer(experienceFacts, experienceAnswer), true);
assert.strictEqual(experienceFacts.experiences[0].description, experienceAnswer.answer);
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
  "activity_description:activity-1",
]);
assert.ok(rankedQuestions.every((question) => question.questionType === "enrichment"));
assert.strictEqual(rankedQuestions.length, 3);
assert.strictEqual(buildEnrichmentQuestions({ projects: [{ id: "project-1", title: "لوحة مبيعات" }] }, {
  skippedFieldKeys: ["project_description:project-1"],
}).length, 0);

console.log("resumeAgentAnswerLifecycle tests passed");
