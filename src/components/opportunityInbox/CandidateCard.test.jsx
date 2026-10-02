import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import CandidateCard, { CandidateContent } from "./CandidateCard";
import { candidateOrigin } from "./candidateOrigin";

test("generic source content warning is explicit and absent for clean content", () => {
  const view = render(<CandidateContent item={{ contentQualityWarning: true, responsibilities: [] }} />);
  expect(screen.getByText("بعض محتوى الإعلان عام ويحتاج مراجعة")).toBeInTheDocument();
  expect(screen.getByText("المهام غير مذكورة")).toBeInTheDocument();
  view.rerender(<CandidateContent item={{ contentQualityWarning: false }} />);
  expect(screen.queryByText("بعض محتوى الإعلان عام ويحتاج مراجعة")).not.toBeInTheDocument();
});

test.each([
  [{ importedVia: "agent", searchDiscovery: { provider: "brave" } }, "Agent"],
  [{ searchDiscovery: { provider: "brave" } }, "Brave"],
  [{ importedVia: "manual" }, "Manual"],
  [{ importedVia: "official_discovery" }, "Official Discovery"],
  [{ sourceType: "company" }, "مصدر سابق غير محدد"],
])("origin respects ingestion provenance, not the claimed sourceType", (item, expected) => {
  expect(candidateOrigin(item)).toBe(expected);
});

test("enriched card shows scope, missing fields, evidence, completeness and retry", () => {
  const onAction = jest.fn();
  const item = { title: "COOP", sourceUrl: "https://example.com/jobs/1", status: "needs_review", reviewStatus: "NEEDS_DETAILS",
    majorScope: "all", completenessScore: 75, confidenceScore: 60, missingFields: ["duration"],
    extractionEvidence: { responsibilities: { sourceUrl: "https://example.com/jobs/1", method: "html_section", heading: "Your role", rawText: "Actual task" } } };
  render(<CandidateCard item={item} onAction={onAction} />);
  expect(screen.getByText("جميع التخصصات")).toBeInTheDocument();
  expect(screen.getByText("تحتاج تفاصيل")).toBeInTheDocument();
  expect(screen.getByLabelText("اكتمال البيانات")).toHaveAttribute("value", "75");
  expect(screen.getByText("Actual task")).toBeInTheDocument();
  expect(screen.getByText(/الناقص: مدة التدريب/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "إعادة الإثراء" }));
  expect(onAction).toHaveBeenCalledWith("retry-enrichment", item);
  expect(screen.getByRole("button", { name: "نشر" })).toBeDisabled();
});

test("agent provenance and unverified notes are visible in candidate details", () => {
  render(<CandidateContent item={{ importedVia: "agent", importSource: "darbak_coop_sweep",
    importRunId: "sweep-001", importedAt: "2026-10-01", verificationNotes: "Awaiting review", duration: "8 weeks" }} />);
  expect(screen.getByLabelText("مصدر الاكتشاف")).toHaveTextContent("Agent");
  expect(screen.getByText("sweep-001")).toBeInTheDocument();
  expect(screen.getByText(/Awaiting review/)).toBeInTheDocument();
  expect(screen.getByText(/8 weeks/)).toBeInTheDocument();
});

test("actionable JS applications are ready for review with an explicit warning", () => {
  render(<CandidateCard item={{ title: "Marketing Internship", company: "Chalhoub Group", status: "ready",
    reviewStatus: "READY_FOR_REVIEW", applicationState: "UNKNOWN_BUT_ACTIONABLE", pageAvailability: "AVAILABLE",
    verificationWarnings: ["حالة نموذج التقديم لم تُتحقق آليًا"], verification: { appearsOpen: null } }} onAction={jest.fn()} />);
  expect(screen.getByText("جاهزة للمراجعة")).toBeInTheDocument();
  expect(screen.getByText("الصفحة متاحة")).toBeInTheDocument();
  expect(screen.getByText("زر التقديم متاح للمراجعة")).toBeInTheDocument();
  expect(screen.getByText("حالة نموذج التقديم لم تُتحقق آليًا")).toBeInTheDocument();
});
