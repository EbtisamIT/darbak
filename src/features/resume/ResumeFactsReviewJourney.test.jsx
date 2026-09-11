import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ResumeFactsReviewJourney from "./ResumeFactsReviewJourney";

jest.mock("./ResumeBuilder", () => ({ resume, onChange, visibleSections, showPersonalInfo, showEducationFacts }) => (
  <div>
    <span data-testid="review-editor">{showPersonalInfo ? "personal" : (showEducationFacts ? "education" : (visibleSections || []).join(","))}</span>
    <button type="button" onClick={() => onChange({ ...resume, summary: "قيمة محدثة" })}>تعديل قيمة</button>
  </div>
));

describe("resume facts review journey", () => {
  const resume = {
    personalInfo: { fullName: "طالبة اختبار", email: "qa@example.com", phone: "0500000000", major: "علوم الحاسب", city: "الرياض" },
    education: [{ id: "education-1", title: "بكالوريوس" }],
    experience: [],
    projects: [{ id: "project-1", title: "مشروع اختبار", description: "وصف المشروع" }],
    skills: ["Python"],
    certifications: [],
    volunteering: [],
    languages: [{ id: "language-1", name: "العربية", level: "اللغة الأم" }],
  };

  beforeEach(() => {
    window.localStorage.clear();
    window.scrollTo = jest.fn();
  });

  it("reuses the setup fields as a step-by-step review flow", async () => {
    const onAutosave = jest.fn().mockResolvedValue(true);
    render(<ResumeFactsReviewJourney resume={resume} onChange={jest.fn()} onAutosave={onAutosave} onBack={jest.fn()} onRebuild={jest.fn()} storageScope="qa" />);

    expect(screen.getByTestId("review-editor")).toHaveTextContent("personal");
    fireEvent.click(screen.getByRole("button", { name: /التالي/ }));
    await waitFor(() => expect(screen.getByTestId("review-editor")).toHaveTextContent("education"));
    expect(onAutosave).toHaveBeenCalledTimes(1);
  });

  it("restores the last review step after refresh", () => {
    window.localStorage.setItem("darbak_resume_facts_review_step:qa", "projects");
    render(<ResumeFactsReviewJourney resume={resume} onChange={jest.fn()} onAutosave={jest.fn().mockResolvedValue(true)} onBack={jest.fn()} onRebuild={jest.fn()} storageScope="qa" />);
    expect(screen.getByTestId("review-editor")).toHaveTextContent("projects");
  });

  it("runs rebuild only from the final explicit CTA after saving", async () => {
    const onAutosave = jest.fn().mockResolvedValue(true);
    const onRebuild = jest.fn();
    window.localStorage.setItem("darbak_resume_facts_review_step:qa", "review");
    render(<ResumeFactsReviewJourney resume={resume} onChange={jest.fn()} onAutosave={onAutosave} onBack={jest.fn()} onRebuild={onRebuild} storageScope="qa" />);

    expect(screen.getByText("1 مشروع")).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /تحديث المسودة/ }));
    await waitFor(() => expect(onAutosave).toHaveBeenCalledTimes(1));
    expect(onRebuild).toHaveBeenCalledTimes(1);
  });
});
