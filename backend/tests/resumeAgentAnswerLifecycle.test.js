const assert = require("assert");
const {
  applyProjectDescriptionAnswer,
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
assert.strictEqual(validateProjectDescriptionAnswer("مشروع جامعي").accepted, false);

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

console.log("resumeAgentAnswerLifecycle tests passed");
