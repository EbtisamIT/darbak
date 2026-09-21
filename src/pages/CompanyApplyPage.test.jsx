import React from "react";
import { render, screen } from "@testing-library/react";
import axios from "axios";
import CompanyApplyPage from "./CompanyApplyPage";

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("react-router-dom", () => ({
  useParams: () => ({ companySlug: "test-program" }),
  Link: ({ children, ...props }) => <a {...props}>{children}</a>,
}));
jest.mock("../utils/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("../utils/premiumAccess", () => ({ getAccessHeaders: () => ({}) }));

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue({
    data: {
      campaign: {
        slug: "test-program",
        companySlug: "test-company",
        organizationName: "شركة اختبار",
        opportunityTitle: "برنامج التدريب التعاوني",
        isOpen: true,
        specialties: [],
        cities: [],
        customQuestions: [],
      },
      snapshot: {},
    },
  });
});

test("shows an optional PDF training letter without changing the required CV", async () => {
  const { container } = render(<CompanyApplyPage />);

  expect(await screen.findByRole("heading", { name: "قدّم على البرنامج" })).toBeInTheDocument();
  const fileInputs = Array.from(container.querySelectorAll('input[type="file"]'));
  expect(fileInputs).toHaveLength(2);
  expect(fileInputs[0]).toBeRequired();
  expect(fileInputs[1]).not.toBeRequired();
  expect(fileInputs[1]).toHaveAttribute("accept", "application/pdf,.pdf");
  expect(screen.getByText("اختياري — PDF بحد أقصى 10MB")).toBeInTheDocument();
});
