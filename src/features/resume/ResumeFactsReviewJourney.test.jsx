import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ResumeFactsReviewJourney from "./ResumeFactsReviewJourney";

jest.mock("./ResumeDataSimpleForm", () => () => <div data-testid="review-simple-form">saved values</div>);

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

  it("reuses the same simple source-facts form for returning students", () => {
    render(<ResumeFactsReviewJourney resume={resume} onChange={jest.fn()} onAutosave={jest.fn()} onBack={jest.fn()} onRebuild={jest.fn()} />);
    expect(screen.getByTestId("review-simple-form")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تحديث المسودة" })).toBeInTheDocument();
  });

  it("runs rebuild only after the latest ResumeProfile facts save", async () => {
    const onAutosave = jest.fn().mockResolvedValue(true);
    const onRebuild = jest.fn();
    render(<ResumeFactsReviewJourney resume={resume} onChange={jest.fn()} onAutosave={onAutosave} onBack={jest.fn()} onRebuild={onRebuild} />);
    fireEvent.click(screen.getByRole("button", { name: /تحديث المسودة/ }));
    await waitFor(() => expect(onAutosave).toHaveBeenCalledTimes(1));
    expect(onRebuild).toHaveBeenCalledTimes(1);
  });
});
