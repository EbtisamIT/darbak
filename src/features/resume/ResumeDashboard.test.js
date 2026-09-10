import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ResumeDashboard, { getCustomizationStatus, getResumeReviewSummary } from "./ResumeDashboard";

describe("resume dashboard state", () => {
  const pendingTranslationResume = {
    settings: { language: "en" },
    experience: [{
      id: "internship-1",
      title: "متدربة محاسبة",
      organization: "شركة الخليج للخدمات",
    }],
    localizedDisplay: {
      entries: {
        "experience:internship-1": {
          title: "Accounting Intern",
          organization: "Gulf Services Company",
        },
      },
    },
  };

  it("uses one review summary for the dashboard count and progress", () => {
    expect(getResumeReviewSummary(pendingTranslationResume)).toEqual({
      total: 1,
      pending: 1,
      approved: 0,
    });
  });

  it("keeps review state independent for each customization", () => {
    const needsReview = getCustomizationStatus({
      variantType: "tailored",
      resumePayload: pendingTranslationResume,
      applicationPack: { resume: { status: "ready" } },
    });
    const ready = getCustomizationStatus({
      variantType: "tailored",
      resumePayload: { localizedDisplay: { review: {} } },
      applicationPack: {
        resume: { status: "ready" },
        trainingLetter: { status: "ready" },
        email: { status: "ready" },
      },
    });

    expect(needsReview.state).toBe("needs_review");
    expect(needsReview.pendingReviewCount).toBe(1);
    expect(ready.state).toBe("ready");
    expect(ready.pendingReviewCount).toBe(0);
  });

  it("marks a stale English version for update without changing the master review count", () => {
    const englishVersion = { needsLocalizationRefresh: true, resumePayload: { localizedDisplay: { review: {} } } };
    expect(englishVersion.needsLocalizationRefresh).toBe(true);
    expect(getResumeReviewSummary(englishVersion.resumePayload).pending).toBe(0);
  });

  it("opens an existing stale English version while keeping refresh as an explicit action", () => {
    const onOpenVersion = jest.fn();
    const onCreateEnglish = jest.fn();
    render(
      <ResumeDashboard
        resume={{ personalInfo: {}, settings: { language: "ar" } }}
        resumeExists
        versions={[{ _id: "english-1", variantType: "translation", language: "en", needsLocalizationRefresh: true }]}
        onOpenEditor={jest.fn()}
        onEditProfile={jest.fn()}
        onReviewResumeSetup={jest.fn()}
        onStartFromPortfolio={jest.fn()}
        onStartFromScratch={jest.fn()}
        onCustomize={jest.fn()}
        onCreateEnglish={onCreateEnglish}
        onOpenVersion={onOpenVersion}
        onDownloadPdf={jest.fn()}
        onOpenEnglishReview={jest.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "النسخة الإنجليزية" })[0]);
    expect(onOpenVersion).toHaveBeenCalledWith(expect.objectContaining({ _id: "english-1" }));
    fireEvent.click(screen.getByRole("button", { name: "تحديث النسخة الإنجليزية" }));
    expect(onCreateEnglish).toHaveBeenCalledTimes(1);
  });

  it("uses the newest English translation when historical versions exist", () => {
    const onOpenVersion = jest.fn();
    render(
      <ResumeDashboard
        resume={{ personalInfo: {}, settings: { language: "ar" } }}
        resumeExists
        versions={[
          { _id: "english-old", variantType: "translation", language: "en", updatedAt: "2026-01-01T00:00:00.000Z", needsLocalizationRefresh: true },
          { _id: "english-new", variantType: "translation", language: "en", updatedAt: "2026-02-01T00:00:00.000Z", needsLocalizationRefresh: false },
        ]}
        onOpenEditor={jest.fn()}
        onEditProfile={jest.fn()}
        onReviewResumeSetup={jest.fn()}
        onStartFromPortfolio={jest.fn()}
        onStartFromScratch={jest.fn()}
        onCustomize={jest.fn()}
        onCreateEnglish={jest.fn()}
        onOpenVersion={onOpenVersion}
        onDownloadPdf={jest.fn()}
        onOpenEnglishReview={jest.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "النسخة الإنجليزية" })[0]);
    expect(onOpenVersion).toHaveBeenCalledWith(expect.objectContaining({ _id: "english-new" }));
  });
});
