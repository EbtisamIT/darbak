import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import axios from "axios";
import ExperiencesPage from "./ExperiencesPage";
import { startSubscriptionFlow } from "../utils/premiumAccess";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/experiences", search: "?city=riyadh" }),
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
}));
jest.mock("axios", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock("../utils/premiumAccess", () => ({
  PREMIUM_STATUS_EVENT: "darbak:premium-status",
  getAccessHeaders: () => ({}),
  hasCoreAccess: () => false,
  requestPremiumAccess: jest.fn(),
  startSubscriptionFlow: jest.fn(),
}));
jest.mock("../components/ShareButton", () => () => null);
jest.mock("../components/PremiumInlineNotice", () => () => null);

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  axios.get.mockResolvedValue({ data: { data: [], total: 0, hasMore: false } });
});

test("experiences banner enters unified checkout on its first click", async () => {
  await act(async () => { render(<ExperiencesPage />); });
  fireEvent.click(screen.getByRole("button", { name: "كمل استكشافك" }));
  expect(startSubscriptionFlow).toHaveBeenCalledTimes(1);
  expect(startSubscriptionFlow).toHaveBeenCalledWith({
    planId: "darbak_plus",
    source: "experiences_plus_banner",
    returnTo: "/experiences?city=riyadh",
    navigate: mockNavigate,
  });
});
