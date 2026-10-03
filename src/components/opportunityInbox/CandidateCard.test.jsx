import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import CandidateCard from "./CandidateCard";
import { candidateOrigin } from "./candidateOrigin";

test.each([
  [{ importedVia: "agent", searchDiscovery: { provider: "brave" } }, "Agent"],
  [{ searchDiscovery: { provider: "brave" } }, "Brave"],
  [{ importedVia: "manual" }, "Manual"],
  [{ importedVia: "official_discovery" }, "Official Discovery"],
])("internal provenance is preserved", (item, expected) => expect(candidateOrigin(item)).toBe(expected));

test("compact card hides technical data and keeps source links and three actions", () => {
  const item = { title: "Internship", company: "Test", status: "needs_verification", programType: "internship",
    cities: ["الرياض"], majors: ["المحاسبة"], confidenceScore: 70, completenessScore: 85,
    sourceUrl: "https://example.com/jobs/1", applicationUrl: "https://example.com/apply",
    aiNotes: "SECRET DEBUG", extractionEvidence: { method: "ats_api" } };
  const onAction = jest.fn();
  render(<CandidateCard item={item} onAction={onAction} />);
  expect(screen.getByText("تحتاج تحقق")).toBeVisible();
  expect(screen.getByText("الرياض")).toBeVisible();
  expect(screen.getByRole("link", { name: "فتح الإعلان الأصلي" })).toHaveAttribute("href", item.sourceUrl);
  expect(screen.getByRole("link", { name: "فتح رابط التقديم" })).toHaveAttribute("href", item.applicationUrl);
  expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  expect(screen.queryByText("SECRET DEBUG")).not.toBeInTheDocument();
  expect(screen.queryByText("معاينة")).not.toBeInTheDocument();
  expect(screen.queryByText("إعادة الإثراء")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "نشر" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Internship" }));
  expect(onAction).toHaveBeenCalledWith("edit", item);
});
test("canonical draft overrides legacy values without inventing absent facts", () => {
  render(<CandidateCard item={{ title: "Old", company: "Old company", status: "needs_review",
    opportunityDraft: { title: "Actual title", organizationName: "Actual company", cities: [], specialties: [], sourceUrl: "" } }} onAction={jest.fn()} />);
  expect(screen.getByText("Actual company")).toBeVisible();
  expect(screen.getByText("المدينة غير مذكورة")).toBeVisible();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.getByText("تحتاج تحقق")).toBeVisible();
});
test.each(["duplicate", "published", "rejected"])("%s cannot publish", (status) => {
  render(<CandidateCard item={{ title: "COOP", status }} onAction={jest.fn()} />);
  expect(screen.getByRole("button", { name: "نشر" })).toBeDisabled();
});
test("update has apply-update instead of publish", () => {
  const onAction = jest.fn(), item = { title: "COOP", status: "update_existing" };
  render(<CandidateCard item={item} onAction={onAction} />);
  expect(screen.queryByRole("button", { name: "نشر" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "تطبيق التحديث" }));
  expect(onAction).toHaveBeenCalledWith("compare", item);
});
