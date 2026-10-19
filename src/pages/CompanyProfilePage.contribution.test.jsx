import React from "react";
import { render, screen } from "@testing-library/react";
import axios from "axios";
import CompanyProfilePage from "./CompanyProfilePage";
import { canShowExperienceReward } from "../utils/experienceRewardRollout";

jest.mock("axios", () => ({ get: jest.fn() }));
jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
  useParams: () => ({ companySlug: "datavolt" }),
  Link: ({ to, children, ...props }) => require("react").createElement("a", { href: to, ...props }, children),
}));
jest.mock("../utils/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("../utils/companySeo", () => ({ setCompanySeo: () => () => {} }));
jest.mock("../utils/experienceRewardRollout", () => ({ canShowExperienceReward: jest.fn(async () => true) }));

test("company CTA opens the existing contribution journey with the company prefill and source", async () => {
  canShowExperienceReward.mockResolvedValue(true);
  axios.get.mockImplementation((url) => Promise.resolve(url.includes("/resolve/")
    ? { data: { data: { slug: "datavolt" } } }
    : { data: { company: { id: "company-1", slug: "datavolt", name: "DataVolt" }, data: { experiences: [], interviews: [], opportunities: [], overview: {} } } }));

  render(<CompanyProfilePage />);

  expect(await screen.findByText("سبق وتدربت في DataVolt؟")).toBeInTheDocument();
  expect(screen.getByText(/إذا تم اعتماد تجربتك تحصل على سيرة ذاتية احترافية مجانًا/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "شارك تجربتك في DataVolt" })).toHaveAttribute(
    "href",
    "/share-experience?companyId=company-1&companyName=DataVolt&contributionSource=company_page"
  );
});
