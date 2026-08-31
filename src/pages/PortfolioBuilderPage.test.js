import {
  getResumeSetupFields,
  getResumeSetupProgress,
} from "../utils/resumeSetupStage";

describe("resume setup missing-field stage", () => {
  const missingStage = (form) =>
    getResumeSetupFields(form, "").filter(([, , complete]) => !complete);

  it("keeps the initial eight fields stable while draft values change", () => {
    const initialForm = { email: "qa@example.com", projects: [], experiences: [] };
    const stageFields = missingStage(initialForm);

    expect(stageFields).toHaveLength(8);
    expect(stageFields.map(([key]) => key)).toEqual([
      "fullName",
      "major",
      "city",
      "university",
      "education",
      "bio",
      "skills",
      "evidence",
    ]);

    const typedDraft = {
      ...initialForm,
      fullName: "سارة أحمد",
      degreeLevel: "بكالوريوس",
    };
    const currentFields = getResumeSetupFields(typedDraft, "");

    expect(stageFields).toHaveLength(8);
    expect(stageFields.map(([key]) => key)).toEqual([
      "fullName",
      "major",
      "city",
      "university",
      "education",
      "bio",
      "skills",
      "evidence",
    ]);
    expect(getResumeSetupProgress(stageFields, currentFields)).toBe(2);
  });

  it("does not mutate the stage snapshot when autosave recomputes current fields", () => {
    const stageFields = missingStage({ email: "qa@example.com" });
    const autosavedDraft = {
      email: "qa@example.com",
      fullName: "سارة أحمد",
      major: "تقنية المعلومات",
    };

    getResumeSetupFields(autosavedDraft, "");

    expect(stageFields.map(([key]) => key)).toEqual([
      "fullName",
      "major",
      "city",
      "university",
      "education",
      "bio",
      "skills",
      "evidence",
    ]);
  });
});
