import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import axios from "axios";
import CompanyProfilePage from "./CompanyProfilePage";

jest.mock("axios", () => ({ get: jest.fn() }));
jest.mock("../utils/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("../utils/experienceRewardRollout", () => ({ canShowExperienceReward: () => Promise.resolve(false) }));
jest.mock("../data/darbakGuideSuggestions", () => ({
  darbakGuideOrganizations: [{
    id: "portal", name: "أرامكو السعودية", contactType: "بوابة برامج الطلبة",
    url: "https://www.aramco.com/en/careers/saudi-applicants/student-opportunities",
    note: "مستخرج من ملف وسائل التواصل، صفحة 3.",
    confidence: "متوسطة - مصدر عام", reviewerNote: "تحقق لاحقًا",
  }],
}));
jest.mock("../data/darbakContactDirectory", () => ({
  darbakContactDirectoryOrganizations: [
    { id: "email", name: "أرامكو السعودية", email: "careers@example.com", contactType: "بريد تواصل/تقديم", note: "الإيميلات مستخرجة من ملف وسائل التواصل، صفحة 30." },
    { id: "broken", name: "389 390 391 mustafa.khamees@ aramco.com", email: "mustafa.khamees@aramco.com 391 390 389", contactType: "بريد تواصل/تقديم" },
    { id: "wrong", name: ".s", email: "wrong@example.com", contactType: "بريد تواصل/تقديم" },
  ],
}));
jest.mock("../data/healthHospitalSuggestions", () => ({ healthHospitalSuggestions: [] }));
jest.mock("../data/trainingInteractiveDirectory", () => ({ trainingInteractiveOrganizations: [] }));

test("Aramco student contact cards show clean channels without extraction metadata", async () => {
  axios.get.mockImplementation((url) => Promise.resolve(url.includes("/resolve/")
    ? { data: { data: { slug: "aramco" } } }
    : { data: { company: { name: "أرامكو السعودية", nameEn: "Saudi Aramco", slug: "aramco" }, data: { experiences: [], interviews: [], opportunities: [], overview: {} } } }));

  render(<MemoryRouter initialEntries={["/companies/aramco"]}>
    <Routes><Route path="/companies/:companySlug" element={<CompanyProfilePage />} /></Routes>
  </MemoryRouter>);

  fireEvent.click(await screen.findByRole("tab", { name: /الفرص/ }));
  expect(await screen.findByRole("heading", { name: "طرق التقديم على الجهة" })).toBeInTheDocument();
  expect(screen.getByText("careers@example.com")).toHaveAttribute("href", "mailto:careers@example.com");
  expect(screen.getByRole("link", { name: /فتح البوابة/ })).toHaveAttribute("href", "https://www.aramco.com/en/careers/saudi-applicants/student-opportunities");
  expect(screen.getByText("بريد التواصل")).toBeInTheDocument();
  expect(screen.getByText("بوابة التدريب")).toBeInTheDocument();
  expect(screen.queryByText(/مستخرج|صفحة 3|متوسطة - مصدر عام|391 390 389/)).not.toBeInTheDocument();
  expect(screen.queryByText("wrong@example.com")).not.toBeInTheDocument();
});
