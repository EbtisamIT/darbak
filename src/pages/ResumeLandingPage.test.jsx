import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ResumeLandingPage from "./ResumeLandingPage";
import { hasResumeAccessPass } from "../utils/premiumAccess";
import { trackEvent } from "../utils/analytics";
import useResumeDiscoveryAccess from "../utils/useResumeDiscoveryAccess";

jest.mock("../utils/premiumAccess", () => ({ hasResumeAccessPass: jest.fn() }));
jest.mock("../utils/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("../utils/useResumeDiscoveryAccess", () => jest.fn());

const renderPage = (initialEntry = "/resume") => render(<MemoryRouter initialEntries={[initialEntry]}><ResumeLandingPage /></MemoryRouter>);

beforeEach(() => {
  hasResumeAccessPass.mockReturnValue(false);
  useResumeDiscoveryAccess.mockReturnValue({ hasAccess: false, hasMaster: false });
  sessionStorage.clear();
  trackEvent.mockClear();
  Element.prototype.scrollIntoView = jest.fn();
});

test("renders rich fictional resume in Arabic and English with the same sections", () => {
  const { container } = renderPage();
  expect(screen.getByText("سيرتك تستحق أكثر من قالب جاهز.")).toBeInTheDocument();
  expect(screen.getAllByText("Darbak ATS Classic").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Darbak Professional").length).toBeGreaterThan(0);
  expect(screen.getByText(/سارة أحمد شخصية افتراضية/)).toBeInTheDocument();
  const demoPreview = container.querySelector(".resume-landing-demo-preview .resume-paper");
  expect(demoPreview.textContent).toContain("لوحة متابعة أداء المبيعات");
  expect(demoPreview.textContent).toContain("نظام حجز المرافق الجامعية");
  expect(demoPreview.textContent).toContain("ITIL 4 Foundation");
  expect(demoPreview.textContent).toContain("4.62/5");
  const languageSwitch = screen.getByRole("group", { name: "لغة نموذج السيرة" });
  fireEvent.click(within(languageSwitch).getByRole("button", { name: "English" }));
  expect(demoPreview.textContent).toContain("Sales Performance Dashboard");
  expect(demoPreview.textContent).toContain("University Facilities Booking System");
  expect(demoPreview.textContent).not.toMatch(/[\u0600-\u06FF]/);
  expect(trackEvent).toHaveBeenCalledWith("resume_landing_view", expect.objectContaining({ metadata: expect.objectContaining({ pageContext: "resume_landing" }) }));
  fireEvent.click(screen.getByRole("button", { name: "شاهد كيف يشتغل دربك" }));
  expect(trackEvent).toHaveBeenCalledWith("resume_example_clicked", expect.objectContaining({ metadata: expect.objectContaining({ placement: "hero" }) }));
  fireEvent.click(screen.getByText("هل السيرة في دربك ATS؟"));
  expect(trackEvent).toHaveBeenCalledWith("resume_faq_opened", { metadata: { questionIndex: 0 } });
});

test("tailoring demo only reveals existing facts and available application outputs", () => {
  renderPage();
  expect(screen.queryByRole("tablist", { name: "مخرجات التخصيص" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "خصص سيرتي لهذه الفرصة" }));
  expect(screen.getByText("الأقرب لفرصة تحليل الأعمال")).toBeInTheDocument();
  expect(screen.getByRole("tablist", { name: "مخرجات التخصيص" })).toBeInTheDocument();
  expect(screen.getByText(/ما يخترع خبرة أو مهارات جديدة/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Cover Letter" }));
  expect(screen.getByText("خطاب تقديم — مثال توضيحي")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "رسالة التقديم" }));
  expect(screen.getByText("رسالة الإيميل — مثال توضيحي")).toBeInTheDocument();
  expect(trackEvent).toHaveBeenCalledWith("resume_tailoring_demo_clicked", expect.any(Object));
});

test("routes non-subscribers to the existing resume plan checkout", () => {
  renderPage();
  const ctas = screen.getAllByRole("link", { name: "ابدأ بناء سيرتي" });
  expect(ctas).toHaveLength(2);
  ctas.forEach((cta) => expect(cta).toHaveAttribute("href", "/subscribe?plan=darbak_resume&source=resume-landing"));
  fireEvent.click(ctas[0]);
  expect(trackEvent).toHaveBeenCalledWith("resume_cta_clicked", expect.objectContaining({ metadata: expect.objectContaining({ placement: "hero", subscriber: false }) }));
});

test("keeps opportunity attribution after revisiting the example from subscriptions", () => {
  sessionStorage.setItem("darbak_resume_discovery_attribution_v1", JSON.stringify({ source: "opportunity_card", pageContext: "opportunity_card", opportunityId: "op-1" }));
  renderPage("/resume?source=subscription_page");
  screen.getAllByRole("link", { name: "ابدأ بناء سيرتي" }).forEach((cta) =>
    expect(cta).toHaveAttribute("href", "/subscribe?plan=darbak_resume&source=resume-opportunity_card")
  );
});

test("routes existing resume subscribers into their resume", () => {
  hasResumeAccessPass.mockReturnValue(true);
  useResumeDiscoveryAccess.mockReturnValue({ hasAccess: true, hasMaster: true });
  renderPage();
  screen.getAllByRole("link", { name: "افتح سيرتي" }).forEach((cta) => expect(cta).toHaveAttribute("href", "/my-resume"));
  expect(screen.getByRole("link", { name: "سيرتك جاهزة؟ خصصها لفرصة" })).toHaveAttribute("href", "/my-resume/tailor");
});

test("invites a resume subscriber without a built resume to start, not tailor", () => {
  hasResumeAccessPass.mockReturnValue(true);
  useResumeDiscoveryAccess.mockReturnValue({ hasAccess: true, hasMaster: false });
  renderPage();
  screen.getAllByRole("link", { name: "ابدأ بناء سيرتي" }).forEach((cta) => expect(cta).toHaveAttribute("href", "/my-resume"));
  expect(screen.queryByRole("link", { name: "سيرتك جاهزة؟ خصصها لفرصة" })).not.toBeInTheDocument();
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
