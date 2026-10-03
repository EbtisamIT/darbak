import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import CandidateEditor from "./CandidateEditor";

const options = { adminColors: {}, adminSelectStyle: {}, opportunityCityOptions: [], majorCategoryOptions: [],
  ALL_SPECIALTIES_VALUE: "__all_specialties__", normalizeFormArray: (value) => value || [],
  getSpecialtiesForCategories: () => [], getCategoriesForSpecialties: () => [],
  MultiChipSelector: ({ label }) => <span>{label}</span>,
  opportunitySelectFields: [{ field: "hasReward", label: "المكافأة", options: [["", "غير محدد"], ["yes", "نعم"]] }] };
test("editor uses the manual Opportunity fields and saves the exact edited draft", () => {
  const onSave = jest.fn();
  render(<CandidateEditor candidate={{ _id: "test", status: "needs_verification", opportunityDraft: {
    organizationName: "Company", title: "Intern", cities: [], specialties: [], majorCategories: [],
    sourceUrl: "https://example.com/job", note: "Actual source content", hasReward: "", featured: false,
  } }} formOptions={options} onSave={onSave} onCancel={jest.fn()} />);
  expect(screen.getByLabelText("اسم الجهة")).toHaveValue("Company");
  expect(screen.getByLabelText("ملاحظة للطلاب")).toHaveValue("Actual source content");
  expect(screen.queryByText("درجة الثقة (0–100)")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("ملاحظة للطلاب"), { target: { value: "Reviewed facts only" } });
  fireEvent.change(screen.getByLabelText("المكافأة"), { target: { value: "yes" } });
  fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ _id: "test", opportunityDraft: expect.objectContaining({
    organizationName: "Company", note: "Reviewed facts only", hasReward: "yes", cities: [], specialties: [],
  }) }));
});
