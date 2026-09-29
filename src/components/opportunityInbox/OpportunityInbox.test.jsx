import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import axios from "axios";
import OpportunityInbox from "./OpportunityInbox";
import CandidateComparison from "./CandidateComparison";

jest.mock("axios", () => {
  const client = jest.fn();
  client.get = jest.fn();
  return client;
});
const candidate = { _id: "000000000000000000000001", title: "فرصة اختبار", company: "جهة اختبار", status: "ready", confidenceScore: 95, cities: [], majors: [], responsibilities: [], requirements: [], verification: {}, discoveredEmails: [{ email: "training@example.com", type: "training", confidence: 80, existing: true }] };
beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({ data: { data: [candidate], summary: { ready: 1 }, total: 1, pages: 1 } });
});
test("loads protected inbox, renders missing facts and existing email", async () => {
  render(<OpportunityInbox password="test" />);
  expect(await screen.findByText("فرصة اختبار")).toBeVisible();
  expect(screen.getByText("المهام غير مذكورة")).toBeVisible();
  expect(screen.getByText("الشروط غير مذكورة")).toBeVisible();
  expect(screen.getByText(/موجود مسبقًا/)).toBeVisible();
  expect(axios.get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: { "x-admin-password": "test" } }));
});
test("does not request protected data without password", () => {
  render(<OpportunityInbox password="" />);
  expect(axios.get).not.toHaveBeenCalled();
});
test("filters only fetch when applied and preserve values", async () => {
  render(<OpportunityInbox password="test" />);
  await screen.findByText("فرصة اختبار");
  fireEvent.change(screen.getByLabelText("المدينة"), { target: { value: "الرياض" } });
  expect(axios.get).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText("تطبيق الفلاتر"));
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  expect(axios.get.mock.calls[1][1].params.city).toBe("الرياض");
});
test("demo publication disabled and error is not reported as success", async () => {
  axios.get.mockResolvedValueOnce({ data: { data: [{ ...candidate, isDemo: true }], summary: {}, total: 1, pages: 1 } });
  render(<OpportunityInbox password="test" />);
  expect(await screen.findByText(/بيانات تجريبية/)).toBeVisible();
  expect(screen.getByRole("button", { name: "نشر" })).toBeDisabled();
});
test("failed publication shows error, not success", async () => {
  jest.spyOn(window, "confirm").mockReturnValue(true);
  axios.mockRejectedValueOnce({ response: { data: { error: "تعذر الحفظ" } } });
  render(<OpportunityInbox password="test" />);
  await screen.findByText("فرصة اختبار");
  fireEvent.click(screen.getByRole("button", { name: "نشر" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("تعذر الحفظ");
  expect(screen.queryByText("تمت العملية بنجاح.")).not.toBeInTheDocument();
  window.confirm.mockRestore();
});
test("comparison applies only explicitly selected fields with version check", () => {
  const onApply = jest.fn();
  render(<CandidateComparison busy={false} onApply={onApply} detail={{ candidate, existing: { updatedAt: "2026-01-01" }, diff: [{ field: "deadline", before: null, after: "2099-01-01", changed: true }, { field: "note", before: "old", after: "new", changed: true }] }} />);
  expect(screen.getByRole("button")).toBeDisabled();
  fireEvent.click(screen.getByLabelText("آخر موعد"));
  fireEvent.click(screen.getByRole("button"));
  expect(onApply).toHaveBeenCalledWith(["deadline"], "2026-01-01");
});
