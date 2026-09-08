const assert = require("assert");
const {
  collectResumeTextForTranslation,
  applyResumeTranslations,
  assertTranslationIntegrity,
} = require("../services/resumeAiService");

const sourceResume = {
  personalInfo: { major: "المحاسبة" },
  summary: "خريجة محاسبة لديها خبرة تدريبية.",
  experience: [{
    id: "dana-internship",
    title: "متدربة محاسبة",
    organization: "شركة الخليج للخدمات",
    achievements: [{ id: "task", text: "أعددت التقارير المحاسبية." }],
  }],
  experiences: [{
    id: "dana-internship",
    title: "متدربة محاسبة",
    organization: "شركة الخليج للخدمات",
    achievements: [{ id: "task", text: "أعددت التقارير المحاسبية." }],
  }],
  settings: { language: "ar" },
};

const items = collectResumeTextForTranslation(sourceResume);
const organizationItem = items.find((item) => item.id === "experience:dana-internship:organization");
assert.ok(organizationItem, "experience organization is included in the explicit English translation request");
assert.strictEqual(organizationItem.target.kind, "localizedEntry");

const merged = applyResumeTranslations(sourceResume, items, [{
  id: organizationItem.id,
  text: "Gulf Services Company",
}]);

assert.strictEqual(
  merged.resume.localizedDisplay.entries["experience:dana-internship"].organization,
  "Gulf Services Company",
);
assert.strictEqual(merged.resume.experience[0].organization, "شركة الخليج للخدمات");
assert.doesNotThrow(() => assertTranslationIntegrity(sourceResume, merged.resume));

console.log("resume translation organization tests passed");
