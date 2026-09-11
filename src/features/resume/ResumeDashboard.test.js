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
        onOpenResume={jest.fn()}
        onReviewResumeSetup={jest.fn()}
        onStartFromPortfolio={jest.fn()}
        onStartFromScratch={jest.fn()}
        onCustomize={jest.fn()}
        onCreateEnglish={onCreateEnglish}
        onOpenVersion={onOpenVersion}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /النسخة الإنجليزية/ }));
    expect(onOpenVersion).toHaveBeenCalledWith(expect.objectContaining({ _id: "english-1" }));
    expect(onCreateEnglish).not.toHaveBeenCalled();
    expect(screen.getByText("تحتاج تحديث", { selector: "small" })).toBeInTheDocument();
  });

  it("keeps one primary master action and one freshness banner", () => {
    const onOpenResume = jest.fn();
    const onReviewResumeSetup = jest.fn();
    render(
      <ResumeDashboard
        resume={{ personalInfo: {}, settings: { language: "ar" } }}
        resumeExists
        factsFreshness={{ changed: true, changes: ["مشروع محدث"] }}
        versions={[]}
        onOpenResume={onOpenResume}
        onReviewResumeSetup={onReviewResumeSetup}
        onStartFromPortfolio={jest.fn()}
        onStartFromScratch={jest.fn()}
        onCustomize={jest.fn()}
        onCreateEnglish={jest.fn()}
        onOpenVersion={jest.fn()}
      />,
    );
    expect(screen.getByText("تحتاج تحديث")).toBeInTheDocument();
    const primaryMasterAction = screen.getAllByRole("button", { name: /فتح السيرة/ })[0];
    expect(primaryMasterAction).toBeInTheDocument();
    fireEvent.click(primaryMasterAction);
    expect(onOpenResume).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /تحديث السيرة/ }));
    expect(onReviewResumeSetup).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText(/0 من 0/)).not.toBeInTheDocument();
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
        onOpenResume={jest.fn()}
        onReviewResumeSetup={jest.fn()}
        onStartFromPortfolio={jest.fn()}
        onStartFromScratch={jest.fn()}
        onCustomize={jest.fn()}
        onCreateEnglish={jest.fn()}
        onOpenVersion={onOpenVersion}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "النسخة الإنجليزية" }));
    expect(onOpenVersion).toHaveBeenCalledWith(expect.objectContaining({ _id: "english-new" }));
  });

  it("shows only the latest three customizations with a link to all", () => {
    const onViewAllCustomizations = jest.fn();
    const versions = Array.from({ length: 4 }, (_, index) => ({
      _id: `tailored-${index}`,
      variantType: "tailored",
      label: `فرصة ${index + 1}`,
      applicationPack: { resume: { status: "ready" } },
    }));
    render(
      <ResumeDashboard
        resume={{ personalInfo: {}, settings: { language: "ar" } }}
        resumeExists
        versions={versions}
        onOpenResume={jest.fn()}
        onReviewResumeSetup={jest.fn()}
        onStartFromPortfolio={jest.fn()}
        onStartFromScratch={jest.fn()}
        onCustomize={jest.fn()}
        onCreateEnglish={jest.fn()}
        onOpenVersion={jest.fn()}
        onViewAllCustomizations={onViewAllCustomizations}
      />,
    );

    expect(screen.getAllByRole("button", { name: /فتح التخصيص/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "عرض كل التخصيصات" }));
    expect(onViewAllCustomizations).toHaveBeenCalledTimes(1);
  });
});
