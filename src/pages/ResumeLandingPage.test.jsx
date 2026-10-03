import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ResumeLandingPage from "./ResumeLandingPage";
import { hasResumeAccessPass } from "../utils/premiumAccess";
import { trackEvent } from "../utils/analytics";

jest.mock("../utils/premiumAccess", () => ({ hasResumeAccessPass: jest.fn() }));
jest.mock("../utils/analytics", () => ({ trackEvent: jest.fn() }));

const renderPage = () => render(<MemoryRouter><ResumeLandingPage /></MemoryRouter>);

beforeEach(() => {
  hasResumeAccessPass.mockReturnValue(false);
  trackEvent.mockClear();
  Element.prototype.scrollIntoView = jest.fn();
});

test("renders both existing templates and tracks example, FAQ, and page view", () => {
  renderPage();
  expect(screen.getByText("سيرتك تستحق أكثر من قالب جاهز.")).toBeInTheDocument();
  expect(screen.getAllByText("Darbak ATS Classic").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Darbak Professional").length).toBeGreaterThan(0);
  expect(screen.getByText("معاينة من قوالب دربك الفعلية ببيانات توضيحية، وليست سيرة طالب حقيقي.")).toBeInTheDocument();
  expect(trackEvent).toHaveBeenCalledWith("resume_landing_view");
  fireEvent.click(screen.getByRole("button", { name: "شاهد نموذج حقيقي" }));
  expect(trackEvent).toHaveBeenCalledWith("resume_example_clicked", { metadata: { template: "ats-classic", placement: "hero" } });
  fireEvent.click(screen.getByText("هل السيرة في دربك ATS؟"));
  expect(trackEvent).toHaveBeenCalledWith("resume_faq_opened", { metadata: { questionIndex: 0 } });
});

test("routes non-subscribers to the existing resume plan checkout", () => {
  renderPage();
  const ctas = screen.getAllByRole("link", { name: "ابدأ بناء سيرتي" });
  expect(ctas).toHaveLength(2);
  ctas.forEach((cta) => expect(cta).toHaveAttribute("href", "/subscribe?plan=darbak_resume&source=resume-landing"));
  fireEvent.click(ctas[0]);
  expect(trackEvent).toHaveBeenCalledWith("resume_cta_clicked", { metadata: { placement: "hero" } });
});

test("routes existing resume subscribers into their resume", () => {
  hasResumeAccessPass.mockReturnValue(true);
  renderPage();
  screen.getAllByRole("link", { name: "ابدأ بناء سيرتي" }).forEach((cta) => expect(cta).toHaveAttribute("href", "/my-resume"));
});

test("sets landing SEO metadata", () => {
  const canonical = document.createElement("link");
  canonical.rel = "canonical";
  document.head.appendChild(canonical);
  renderPage();
  expect(document.title).toContain("سيرتي بدربك | سيرة عربية وإنجليزية محسنة للـ ATS");
  expect(canonical.href).toBe("https://darbak.space/resume");
  canonical.remove();
});
