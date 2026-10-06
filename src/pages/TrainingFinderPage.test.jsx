import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "axios";
import TrainingFinderPage from "./TrainingFinderPage";
import useResumeDiscoveryAccess from "../utils/useResumeDiscoveryAccess";

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("../components/ResumeServicePromo", () => () => null);
jest.mock("../components/AnimatedCount", () => ({ value }) => <span>{value}</span>);
jest.mock("../utils/useResumeDiscoveryAccess", () => jest.fn());
jest.mock("../utils/analytics", () => ({
  trackEvent: jest.fn(),
  trackEventOncePerSession: jest.fn(),
}));
jest.mock("../utils/opportunityAccess", () => ({
  getOpportunityErrorMessage: () => "تعذر التحميل",
  requestOpportunityAccess: jest.fn(),
}));
jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => (
    <a href={typeof to === "string" ? to : to.pathname} {...props}>{children}</a>
  ),
  useLocation: () => ({ pathname: "/where-to-train", search: "", state: null }),
  useNavigate: () => jest.fn(),
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams()],
}));

const opportunities = [
  {
    _id: "opp-one",
    title: "متدرب تقنية المعلومات",
    organizationName: "شركة ألف",
    city: "الرياض",
    specialties: ["علوم الحاسب"],
    applicationUrl: "https://example.com/apply",
    status: "open",
    note: "شروط التقديم: طالب تدريب تعاوني",
  },
  {
    _id: "opp-two",
    title: "متدرب تسويق",
    organizationName: "شركة باء",
    city: "جدة",
    specialties: ["التسويق"],
    applicationUrl: "https://example.com/apply-two",
    status: "open",
  },
];
const { requestOpportunityAccess } = require("../utils/opportunityAccess");

const renderPage = () => render(<TrainingFinderPage />);

beforeEach(() => {
  jest.clearAllMocks();
  useResumeDiscoveryAccess.mockReturnValue({ hasAccess: false, hasMaster: false });
  window.localStorage.clear();
  window.sessionStorage.clear();
  axios.get.mockImplementation((url) => {
    if (url.endsWith("/api/opportunities")) {
      return Promise.resolve({ data: { data: opportunities } });
    }
    if (url.endsWith("/api/opportunities/opp-one")) {
      return Promise.resolve({ data: { data: opportunities[0] } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
  axios.post.mockResolvedValue({ data: {} });
  requestOpportunityAccess.mockImplementation((detail, onGranted) => {
    const opportunity = opportunities.find((item) => detail.itemKey === `opportunity:${item._id}`);
    if (opportunity) onGranted(opportunity);
  });
});

test("search is the first control, and promo can be dismissed for the session", async () => {
  window.localStorage.setItem("darbak_premium_gate_preview_v1", "true");
  const { unmount } = renderPage();
  await screen.findByText("متدرب تقنية المعلومات");
  const main = document.querySelector(".where-to-train-page");
  expect(main.querySelector("form input").placeholder).toBe("ابحث عن فرصة أو جهة...");
  expect(main.querySelector("header").compareDocumentPosition(main.querySelector("form")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const dismiss = screen.getByRole("button", { name: "إخفاء إعلان دربك+" });
  expect(screen.getByRole("link", { name: /افتح باقات دربك بلس/ })).toHaveAttribute("href", expect.stringContaining("/subscribe"));
  fireEvent.click(dismiss);
  expect(screen.queryByRole("button", { name: "إخفاء إعلان دربك+" })).not.toBeInTheDocument();
  unmount();
  renderPage();
  await screen.findByText("متدرب تقنية المعلومات");
  expect(screen.queryByRole("button", { name: "إخفاء إعلان دربك+" })).not.toBeInTheDocument();
});

test("feed cards expose only details and apply text actions with icon save and share", async () => {
  renderPage();
  const title = await screen.findByText("متدرب تقنية المعلومات");
  const card = title.closest(".opportunity-card");
  expect(within(card).getByRole("button", { name: "التفاصيل" })).toBeInTheDocument();
  expect(within(card).getByRole("button", { name: /تقديم الآن|قدّم مجانًا/ })).toBeInTheDocument();
  expect(within(card).getByRole("button", { name: "حفظ الفرصة" })).toBeInTheDocument();
  expect(within(card).getByRole("button", { name: "مشاركة صديق" })).toBeInTheDocument();
  expect(within(card).queryByText("تم التقديم")).not.toBeInTheDocument();
  expect(within(card).queryByText(/خلّ دربك يجهّز تقديمك/)).not.toBeInTheDocument();
  expect(within(card).queryByRole("link", { name: "شاهد سيرتي بدربك" })).not.toBeInTheDocument();
  expect(card.querySelectorAll(".opportunity-card-badges > *").length).toBeLessThanOrEqual(2);
  fireEvent.click(within(card).getByRole("button", { name: "حفظ الفرصة" }));
  expect(within(card).getByRole("button", { name: "إزالة الفرصة من المحفوظات" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: /تفاصيل شركة ألف/ })).not.toBeInTheDocument();
  fireEvent.click(within(card).getByRole("button", { name: "مشاركة صديق" }));
  expect(await screen.findByRole("menu", { name: "خيارات المشاركة" })).toBeInTheDocument();
});

test("details show one resume helper, a single primary apply action, and quiet utilities", async () => {
  renderPage();
  const card = (await screen.findByText("متدرب تقنية المعلومات")).closest(".opportunity-card");
  fireEvent.click(within(card).getByRole("button", { name: "التفاصيل" }));
  const dialog = await screen.findByRole("dialog", { name: /تفاصيل شركة ألف/ });
  await within(dialog).findByText("شروط التقديم: طالب تدريب تعاوني");
  expect(within(dialog).getByText("شروط التقديم ومعلومات الفرصة")).toBeInTheDocument();
  expect(within(dialog).getByText("قبل ما تقدم")).toBeInTheDocument();
  expect(within(dialog).getByText("قدمت مسبقًا؟")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "تم التقديم ✓" })).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "حفظ" })).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "مشاركة الفرصة" })).toBeInTheDocument();
  expect(within(dialog).getByRole("link", { name: /شاهد سيرتي بدربك/ })).toHaveAttribute("href", expect.stringContaining("/resume"));
  expect(dialog.querySelectorAll(".opportunity-detail-resume-helper .opportunity-detail-resume-action")).toHaveLength(1);
  expect(within(dialog).queryByRole("button", { name: "إغلاق" })).not.toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: /تقديم الآن/ })).toBeInTheDocument();
  requestOpportunityAccess.mockImplementation(() => {});
  fireEvent.click(within(dialog).getByRole("button", { name: /تقديم الآن/ }));
  expect(requestOpportunityAccess).toHaveBeenCalledWith(
    expect.objectContaining({ feature: "opportunity_apply", itemKey: "opportunity:opp-one" }),
    expect.any(Function)
  );
});

test("details show only the existing tailored resume path when a resume exists", async () => {
  useResumeDiscoveryAccess.mockReturnValue({ hasAccess: true, hasMaster: true });
  renderPage();
  const card = (await screen.findByText("متدرب تقنية المعلومات")).closest(".opportunity-card");
  fireEvent.click(within(card).getByRole("button", { name: "التفاصيل" }));
  const dialog = await screen.findByRole("dialog", { name: /تفاصيل شركة ألف/ });
  expect(within(dialog).getByRole("button", { name: "خصص سيرتك لهذه الفرصة" })).toBeInTheDocument();
  expect(within(dialog).queryByText(/شاهد سيرتي بدربك/)).not.toBeInTheDocument();
  expect(dialog.querySelectorAll(".opportunity-detail-resume-helper .opportunity-detail-resume-action")).toHaveLength(1);
});

test("search, specialty and city keep the existing request flow", async () => {
  renderPage();
  await screen.findByText("متدرب تقنية المعلومات");
  fireEvent.change(screen.getByPlaceholderText("ابحث عن فرصة أو جهة..."), {
    target: { value: "شركة ألف" },
  });
  fireEvent.change(screen.getByPlaceholderText("اكتب تخصصك أو اختره"), {
    target: { value: "علوم الحاسب" },
  });
  fireEvent.change(screen.getByLabelText("المدينة"), {
    target: { value: "الرياض" },
  });
  fireEvent.click(screen.getByRole("button", { name: "ابحث" }));
  await waitFor(() =>
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/api/opportunities"),
      expect.objectContaining({
        params: expect.objectContaining({
          organization: "شركة ألف",
          search: "شركة ألف",
        }),
      })
    )
  );
  expect(screen.getByLabelText("المدينة")).toHaveValue("الرياض");
  expect(screen.getByPlaceholderText("اكتب تخصصك أو اختره")).toHaveValue("علوم الحاسب");
});

test("limited access still shows the locked preview instead of full details", async () => {
  requestOpportunityAccess.mockImplementation((detail) => detail.onLimited({ reason: "missing_identity" }));
  renderPage();
  const card = (await screen.findByText("متدرب تقنية المعلومات")).closest(".opportunity-card");
  fireEvent.click(within(card).getByRole("button", { name: "التفاصيل" }));
  const dialog = await screen.findByRole("dialog", { name: /تفاصيل شركة ألف/ });
  await within(dialog).findByText(/هذه معاينة مختصرة للفرصة/);
  expect(within(dialog).queryByText("شروط التقديم: طالب تدريب تعاوني")).not.toBeInTheDocument();
});

test("apply keeps the existing access request without opening details", async () => {
  requestOpportunityAccess.mockImplementation(() => {});
  renderPage();
  const card = (await screen.findByText("متدرب تقنية المعلومات")).closest(".opportunity-card");
  fireEvent.click(within(card).getByRole("button", { name: "تقديم الآن" }));
  expect(requestOpportunityAccess).toHaveBeenCalledWith(
    expect.objectContaining({ feature: "opportunity_apply", itemKey: "opportunity:opp-one" }),
    expect.any(Function)
  );
  expect(screen.queryByRole("dialog", { name: /تفاصيل شركة ألف/ })).not.toBeInTheDocument();
});

test("mobile grid rule is one column through 760px and actions stay two columns at 320px", async () => {
  renderPage();
  await screen.findByText("متدرب تقنية المعلومات");
  const css = Array.from(document.querySelectorAll("style"))
    .map((style) => style.textContent)
    .join("\n");
  expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.where-to-train-page \.opportunities-grid\s*\{\s*grid-template-columns: minmax\(0, 1fr\) !important/);
  expect(css).toMatch(/\.where-to-train-page \.opportunity-card \.opportunity-actions\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
});
