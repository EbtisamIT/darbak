import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import HomePage from "./HomePage";

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn(),
}));
jest.mock("../components/AnimatedCount", () => ({ value }) => <span>{value}</span>);
jest.mock("../components/PublicTestimonials", () => () => null);
jest.mock("../utils/useResumeDiscoveryAccess", () => () => ({ hasAccess: false, hasMaster: false }));

const response = (data) => ({ ok: true, json: async () => data });
const resumeCard = () => screen.getByText("دربك+ سيرة").closest("article");

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  delete global.fetch;
});

test("homepage waits for the canonical plan price instead of calling it unavailable", async () => {
  let resolvePlans;
  const plansResponse = new Promise((resolve) => { resolvePlans = resolve; });
  global.fetch = jest.fn((url) => url.endsWith("/api/subscriptions/plans")
    ? plansResponse
    : Promise.resolve(response({ data: [] })));

  render(<HomePage />);
  expect(within(resumeCard()).getByText(/جارِ تحميل السعر/)).toBeInTheDocument();
  expect(within(resumeCard()).queryByText(/السعر غير متاح/)).not.toBeInTheDocument();

  resolvePlans(response({ plans: [
    { id: "darbak_plus", priceSar: 5.99, durationDays: 30 },
    { id: "one_time_90", priceSar: 15, durationDays: 90 },
    { id: "darbak_resume", planKey: "darbak_resume", label: "دربك+ سيرة", priceSar: 34.99, durationDays: 30 },
  ] }));
  await waitFor(() => expect(within(resumeCard()).getByText(/34\.99 ريال/)).toBeInTheDocument());
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/subscriptions/plans"));
});

test("homepage marks price unavailable only after the pricing request fails", async () => {
  let rejectPlans;
  const plansResponse = new Promise((resolve, reject) => { rejectPlans = reject; });
  global.fetch = jest.fn((url) => url.endsWith("/api/subscriptions/plans")
    ? plansResponse
    : Promise.resolve(response({ data: [] })));

  render(<HomePage />);
  expect(within(resumeCard()).getByText(/جارِ تحميل السعر/)).toBeInTheDocument();
  rejectPlans(new Error("pricing unavailable"));
  await waitFor(() => expect(within(resumeCard()).getByText(/السعر غير متاح حاليًا/)).toBeInTheDocument());
});
