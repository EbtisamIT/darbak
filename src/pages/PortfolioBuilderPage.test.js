import {
  getResumeSetupCompleteness,
  getResumeSetupFields,
  getResumeSetupInputId,
  getResumeSetupProgress,
} from "../utils/resumeSetupStage";

describe("resume setup missing-field stage", () => {
  const missingStage = (form) =>
    getResumeSetupFields(form, "").filter(([, , complete]) => !complete);

  it("keeps the initial missing fields stable while draft values change", () => {
    const initialForm = { email: "qa@example.com", projects: [], experiences: [] };
    const stageFields = missingStage(initialForm);

    expect(stageFields).toHaveLength(8);
    expect(stageFields.map(([key]) => key)).toEqual([
      "fullName",
      "major",
      "city",
      "university",
      "education",
      "academicTrack",
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
      "academicTrack",
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
      "academicTrack",
      "skills",
      "evidence",
    ]);
  });

  it("keeps all onboarding inputs visible while draft values are autosaved", () => {
    const onboardingFields = getResumeSetupFields({ email: "qa@example.com" }, "");
    const autosavedDraft = getResumeSetupFields({
      email: "qa@example.com",
      fullName: "سارة أحمد",
      major: "تقنية المعلومات",
    }, "");

    expect(onboardingFields).toHaveLength(9);
    expect(onboardingFields.map(([key]) => key)).toEqual(autosavedDraft.map(([key]) => key));
    expect(getResumeSetupProgress(onboardingFields, autosavedDraft)).toBe(3);
  });

  it("repairs stale completion from current facts instead of any saved workflow", () => {
    const staleAccount = getResumeSetupCompleteness({
      fullName: "سارة أحمد",
      major: "تقنية المعلومات",
      city: "الرياض",
      university: "جامعة الملك سعود",
      email: "sara@example.com",
      bio: "مهتمة بالمنتجات الرقمية",
      skills: "React",
      projects: [{ title: "دربك" }],
      studentStatus: "",
      degreeLevel: "",
    }, "sara@example.com");

    expect(staleAccount.completedCount).toBe(7);
    expect(staleAccount.missingCount).toBe(2);
    expect(staleAccount.fields.find(([key]) => key === "education")[2]).toBe(false);
  });

  it("maps each checklist item to its editable input", () => {
    expect(getResumeSetupInputId("education")).toBe("resume-setup-education");
    expect(getResumeSetupInputId("academicTrack")).toBe("resume-setup-academicTrack");
    expect(getResumeSetupInputId("skills")).toBe("resume-setup-skills");
  });

  it("requires an explicit academic-track choice, including no track", () => {
    const unanswered = getResumeSetupCompleteness({ email: "qa@example.com" }, "");
    const confirmedNoTrack = getResumeSetupCompleteness({
      email: "qa@example.com",
      academicTrack: "no_academic_track",
    }, "");

    expect(unanswered.fields.find(([key]) => key === "academicTrack")[2]).toBe(false);
    expect(confirmedNoTrack.fields.find(([key]) => key === "academicTrack")[2]).toBe(true);
  });
});
