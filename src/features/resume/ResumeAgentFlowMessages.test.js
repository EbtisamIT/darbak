import {
  getStudentVisibleAgentMessages,
  getStudentVisibleMissingNotes,
} from "./resumeAgentMessages";

describe("resume agent student messages", () => {
  it("hides internal validation details and keeps human guidance", () => {
    expect(getStudentVisibleAgentMessages([
      "quality_validation_failed",
      "PENDING_DRAFT_INVALID",
      "project_description:abc",
      "يمكنك إضافة جهة الشهادة لاحقًا.",
    ])).toEqual(["يمكنك إضافة جهة الشهادة لاحقًا."]);
  });

  it("does not render actionable questions as dead draft notes", () => {
    expect(getStudentVisibleMissingNotes([
      { fieldKey: "project_description:abc", inputType: "textarea", message: "أكمل وصف المشروع" },
      { message: "يمكنك إضافة جهة الشهادة لاحقًا." },
    ])).toEqual([{ message: "يمكنك إضافة جهة الشهادة لاحقًا." }]);
  });
});
