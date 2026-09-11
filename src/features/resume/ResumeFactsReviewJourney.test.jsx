import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ResumeFactsReviewJourney from "./ResumeFactsReviewJourney";

jest.mock("./ResumeBuilder", () => ({ resume, onChange }) => (
  <button type="button" onClick={() => onChange({ ...resume, summary: "محدثة" })}>محرر البيانات</button>
));

jest.mock("./ResumePreview", () => ({ resume }) => (
  <div data-testid="resume-preview">{resume.summary || "المعاينة الحالية"}</div>
));

describe("resume facts review journey", () => {
  const resume = {
    personalInfo: {
      fullName: "طالبة اختبار",
      email: "qa@example.com",
      phone: "0500000000",
      major: "علوم الحاسب",
      city: "الرياض",
      university: "جامعة الملك سعود",
      degree: "بكالوريوس",
      studentStatus: "student",
    },
    skills: ["Python"],
    projects: [{ id: "project-1", title: "مشروع اختبار", description: "وصف المشروع" }],
    education: [],
    experience: [],
    certifications: [],
    volunteering: [],
    settings: { language: "ar" },
  };

  it("keeps the current resume visible beside the facts editor", () => {
    render(
      <ResumeFactsReviewJourney
        resume={resume}
        freshness={{ changed: false }}
        onChange={jest.fn()}
        onBack={jest.fn()}
        onRebuild={jest.fn()}
      />,
    );

    expect(screen.getByRole("complementary", { name: "معاينة السيرة الحالية" })).toBeInTheDocument();
    expect(screen.getByTestId("resume-preview")).toHaveTextContent("المعاينة الحالية");
  });

  it("opens and closes the mobile resume preview without losing the editor", () => {
    render(
      <ResumeFactsReviewJourney
        resume={resume}
        freshness={{ changed: true, changes: ["مشروع محدث"] }}
        onChange={jest.fn()}
        onBack={jest.fn()}
        onRebuild={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "معاينة السيرة الحالية" }));
    expect(screen.getByRole("dialog", { name: "معاينة السيرة الحالية" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "إغلاق المعاينة" }));
    expect(screen.queryByRole("dialog", { name: "معاينة السيرة الحالية" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "محرر البيانات" })).toBeInTheDocument();
  });
});
