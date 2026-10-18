import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { pdf } from "@react-pdf/renderer";
import ExperienceRewardResumePage from "./ExperienceRewardResumePage";
import { toAtsClassicResume } from "../utils/experienceRewardResume";
import { cleanRewardDraft, getRewardReadiness } from "../utils/experienceRewardResumeQuality";
import { rewardResumeDemoArabic, rewardResumeDemoEnglish } from "../utils/experienceRewardResumeQuality.fixtures";

jest.mock("axios", () => ({ get: jest.fn(), put: jest.fn(), post: jest.fn() }));
jest.mock("@react-pdf/renderer", () => ({ pdf: jest.fn(() => ({ toBlob: async () => new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }) })) }));
jest.mock("../features/resume/ResumePdfDocument", () => () => null);
jest.mock("../utils/premiumAccess", () => ({
  getStoredAccessIdentity: () => ({ contact: "student@example.com", accessCode: "ABCD1234" }),
}));

const prefill = {
  fullName: "طالب دربك", email: "student@example.com", city: "الرياض",
  major: "تقنية المعلومات", university: "جامعة", educationCity: "الرياض", graduationYear: "2026", gpa: "",
  phone: "", linkedin: "", experience: [], projects: [], certifications: [],
  skills: ["Excel", "SQL", "التواصل"], languages: [], trainingExperience: [{ title: "تدريب", organization: "DataVolt", location: "الرياض", period: "2025", description: "حللت بيانات التدريب" }],
};

beforeEach(() => {
  jest.clearAllMocks();
  pdf.mockImplementation(() => ({ toBlob: async () => new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }) }));
  axios.get.mockResolvedValue({ data: { reward: { id: "reward-1", status: "available", v11Enabled: true, language: null }, prefill } });
  axios.put.mockImplementation(async (_, body) => ({ data: { language: body.language, draft: body.draft } }));
  axios.post.mockResolvedValue({ data: { status: "redeemed", v11Enabled: true } });
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test("reward route requires an owned reward and never opens the builder on 404", async () => {
  axios.get.mockRejectedValueOnce({ response: { status: 404, data: { error: "لا توجد مكافأة" } } });
  render(<ExperienceRewardResumePage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("لا توجد مكافأة");
  expect(screen.queryByText("اعتماد وإنشاء السيرة الذاتية")).not.toBeInTheDocument();
});

test("non-QA users retain the V1 reward builder while V1.1 is QA-only", async () => {
  axios.get.mockResolvedValue({ data: { reward: { id: "reward-1", status: "available",
    v11Enabled: false, language: null }, prefill } });
  render(<ExperienceRewardResumePage />);
  fireEvent.click(await screen.findByText("العربية"));
  expect(await screen.findByText("التخصص أو المؤهل")).toBeInTheDocument();
  expect(screen.queryByText("اقتراح صياغة مهنية")).not.toBeInTheDocument();
});

test("preview saves independent draft without finalizing; finalize once then download", async () => {
  render(<ExperienceRewardResumePage />);
  fireEvent.click(await screen.findByText("العربية"));
  expect(screen.getByDisplayValue("DataVolt")).toBeInTheDocument();
  fireEvent.click(screen.getByText("معاينة السيرة"));
  await waitFor(() => expect(pdf).toHaveBeenCalledTimes(1));
  expect(pdf.mock.calls[0][0].props.rewardPresentation).toBe("v11");
  expect(await screen.findByTitle("معاينة السيرة الذاتية")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("اعتماد وإنشاء السيرة الذاتية")).not.toBeDisabled());
  expect(axios.put).toHaveBeenCalledTimes(1);
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("اعتماد وإنشاء السيرة الذاتية"));
  await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(pdf).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("سيرتك جاهزة ✅")).toBeInTheDocument();
  expect(screen.queryByText("اعتماد وإنشاء السيرة الذاتية")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("تنزيل PDF"));
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/rewards/resume/pdf"), expect.objectContaining({ responseType: "blob" })));
});

test("autosaved draft restores every edited section after reopening and signing in again", async () => {
  let savedDraft = null;
  let savedLanguage = null;
  axios.put.mockImplementation(async (_, body) => {
    savedDraft = body.draft;
    savedLanguage = body.language;
    return { data: { language: savedLanguage, draft: savedDraft } };
  });
  axios.get.mockImplementation(async () => ({ data: {
    reward: { id: "reward-1", status: "available", v11Enabled: true, language: savedLanguage,
      hasDraft: Boolean(savedDraft) },
    draft: savedDraft, prefill,
  } }));
  const first = render(<ExperienceRewardResumePage />);
  fireEvent.click(await screen.findByText("العربية"));
  fireEvent.change(screen.getByLabelText("الجامعة"), { target: { value: "جامعة الملك سعود" } });
  fireEvent.change(document.querySelector(".experience-reward-page textarea"),
    { target: { value: "نبذة عدلتها بنفسي" } });
  fireEvent.change(screen.getByPlaceholderText("نقطة 1"), { target: { value: "أعددت تقارير أسبوعية" } });
  fireEvent.click(screen.getByText("إضافة المشاريع"));
  fireEvent.change(screen.getByLabelText("اسم المشروع"), { target: { value: "مشروع التخرج" } });
  const skill = screen.getByPlaceholderText("أضف مهارة ثم Enter");
  fireEvent.change(skill, { target: { value: "Power BI" } });
  fireEvent.keyDown(skill, { key: "Enter" });
  fireEvent.blur(skill);
  await waitFor(() => expect(savedDraft?.projects?.[0]?.title).toBe("مشروع التخرج"));
  await waitFor(() => expect(savedDraft?.skills).toContain("Power BI"));
  await screen.findByText("المسودة محفوظة في حسابك");
  expect(savedLanguage).toBe("ar");
  expect(axios.post).not.toHaveBeenCalled();
  first.unmount();
  render(<ExperienceRewardResumePage />);
  expect(await screen.findByDisplayValue("جامعة الملك سعود")).toBeInTheDocument();
  expect(screen.getByDisplayValue("نبذة عدلتها بنفسي")).toBeInTheDocument();
  expect(screen.getAllByPlaceholderText("نقطة 1")[0]).toHaveValue("أعددت تقارير أسبوعية");
  expect(screen.getByDisplayValue("مشروع التخرج")).toBeInTheDocument();
  expect(screen.getByText("Power BI")).toBeInTheDocument();
  expect(screen.getByText("اللغة: العربية")).toBeInTheDocument();
});

test("leaving immediately sends the latest unsaved draft with a keepalive request", async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  try {
    render(<ExperienceRewardResumePage />);
    fireEvent.click(await screen.findByText("العربية"));
    fireEvent.change(screen.getByLabelText("الاسم"), { target: { value: "اسم محفوظ عند المغادرة" } });
    fireEvent(window, new Event("pagehide"));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/rewards/resume/draft"),
      expect.objectContaining({ method: "PUT", keepalive: true }));
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).draft.fullName).toBe("اسم محفوظ عند المغادرة");
    expect(axios.post).not.toHaveBeenCalled();
  } finally { global.fetch = originalFetch; }
});

test("redeemed reward reopens read-only and views or downloads the saved PDF without rendering", async () => {
  const finalPdf = new Blob(["saved-pdf"], { type: "application/pdf" });
  axios.get.mockImplementation(async (url) => url.endsWith("/pdf")
    ? { data: finalPdf } : { data: { reward: { id: "reward-1", status: "redeemed", v11Enabled: true, language: "ar" }, draft: prefill } });
  const first = render(<ExperienceRewardResumePage />);
  expect(await screen.findByText("سيرتك جاهزة ✅")).toBeInTheDocument();
  expect(screen.queryByText("اعتماد وإنشاء السيرة الذاتية")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("عرض السيرة"));
  expect(await screen.findByTitle("السيرة الذاتية النهائية")).toBeInTheDocument();
  fireEvent.click(screen.getByText("تنزيل PDF"));
  await waitFor(() => expect(axios.get.mock.calls.filter(([url]) => url.endsWith("/pdf"))).toHaveLength(2));
  first.unmount();
  render(<ExperienceRewardResumePage />);
  fireEvent.click(await screen.findByText("تنزيل PDF"));
  await waitFor(() => expect(axios.get.mock.calls.filter(([url]) => url.endsWith("/pdf"))).toHaveLength(3));
  expect(pdf).not.toHaveBeenCalled();
  expect(axios.put).not.toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalled();
});

test("ATS Classic adapter does not grant subscription or use ResumeProfile/Agent/translation", () => {
  const resume = toAtsClassicResume(prefill, "en");
  expect(resume.settings.template).toBe("ats-classic");
  expect(resume.settings.language).toBe("en");
  expect(resume.experience[0].organization).toBe("DataVolt");
  expect(resume.access.aiResumeUsageLimit).toBe(0);
  expect(resume.subscription).toBeUndefined();
});

test("English reward asks the student to review English text without calling translation", async () => {
  render(<ExperienceRewardResumePage />);
  fireEvent.click(await screen.findByText("English"));
  fireEvent.click(screen.getByText("اعتماد وإنشاء السيرة الذاتية"));
  expect(screen.getByText("راجع نص السيرة بالإنجليزية قبل الاعتماد.")).toBeInTheDocument();
  expect(axios.post).not.toHaveBeenCalled();
  expect(screen.getByText("لا توجد ترجمة تلقائية.", { exact: false })).toBeInTheDocument();
});

test("structured training bullets persist in existing description and preview does not finalize", async () => {
  render(<ExperienceRewardResumePage />);
  fireEvent.click(await screen.findByText("العربية"));
  fireEvent.click(screen.getByText("+ أضف نقطة"));
  fireEvent.change(screen.getByPlaceholderText("نقطة 2"), { target: { value: "استخدمت Excel لإعداد تقرير" } });
  fireEvent.click(screen.getByText("معاينة السيرة"));
  await waitFor(() => expect(axios.put).toHaveBeenCalled());
  expect(axios.put.mock.calls[0][1].draft.trainingExperience[0].description)
    .toBe("حللت بيانات التدريب\nاستخدمت Excel لإعداد تقرير");
  expect(axios.post).not.toHaveBeenCalled();
});

test("finalization names missing required items and does not send PDF", async () => {
  axios.get.mockResolvedValueOnce({ data: { reward: { status: "available", v11Enabled: true, language: null },
    prefill: { ...prefill, skills: ["Excel"], trainingExperience: [{ ...prefill.trainingExperience[0], description: "" }] } } });
  render(<ExperienceRewardResumePage />);
  fireEvent.click(await screen.findByText("العربية"));
  fireEvent.click(screen.getByText("اعتماد وإنشاء السيرة الذاتية"));
  expect(screen.getByRole("status")).toHaveTextContent("تجربة التدريب");
  expect(screen.getByRole("status")).toHaveTextContent("ثلاث مهارات");
  expect(axios.post).not.toHaveBeenCalled();
});

test("incomplete draft can still be previewed without consuming the reward", async () => {
  axios.get.mockResolvedValueOnce({ data: { reward: { status: "available", v11Enabled: true, language: null },
    prefill: { ...prefill, fullName: "", email: "", skills: [] } } });
  render(<ExperienceRewardResumePage />);
  fireEvent.click(await screen.findByText("العربية"));
  fireEvent.click(screen.getByText("معاينة السيرة"));
  await waitFor(() => expect(pdf).toHaveBeenCalledTimes(1));
  expect(axios.post).not.toHaveBeenCalled();
});

test("reward draft cleanup removes exact duplicates, normalizes dates and hides empty entries", () => {
  const clean = cleanRewardDraft({ ...prefill, skills: [" Excel ", "Excel", " SQL "],
    trainingExperience: [{ ...prefill.trainingExperience[0], period: "٢٠٢٥/٧", description: "• حللت البيانات\nحللت البيانات\n- أعددت تقريرًا\n" }],
    projects: [{ title: "", organization: "", location: "", period: "", description: "" }],
  });
  expect(clean.skills).toEqual(["Excel", "SQL"]);
  expect(clean.trainingExperience[0].period).toBe("2025-07");
  expect(clean.trainingExperience[0].description).toBe("حللت البيانات\nأعددت تقريرًا");
  expect(clean.projects).toEqual([]);
  const resume = toAtsClassicResume(clean, "ar");
  expect(resume.experience[0].achievements.map((item) => item.text)).toEqual(["حللت البيانات", "أعددت تقريرًا"]);
  expect(resume.projects).toHaveLength(0);
});

test("readiness checks real required and optional content without a score", () => {
  const readiness = getRewardReadiness(prefill, "ar");
  expect(readiness.missing).toEqual([]);
  expect(readiness.checks.find((check) => check.key === "projects")).toMatchObject({ required: false, ready: true });
  expect(getRewardReadiness({ ...prefill, projects: [{ ...prefill.trainingExperience[0], organization: "" }] }, "ar")
    .checks.find((check) => check.key === "projects").ready).toBe(false);
  expect(getRewardReadiness({ ...prefill, major: "شهادة تحليل بيانات", university: "أكاديمية طويق" }, "ar").missing).toEqual([]);
  expect(getRewardReadiness({ ...prefill, email: "", phone: "+966 50 000 0000" }, "ar").missing).toEqual([]);
});

test("realistic Arabic and user-entered English demos map to ATS Classic without empty sections", () => {
  [
    [rewardResumeDemoArabic, "ar"],
    [rewardResumeDemoEnglish, "en"],
  ].forEach(([draft, language]) => {
    expect(getRewardReadiness(draft, language).missing).toEqual([]);
    const resume = toAtsClassicResume(draft, language);
    expect(resume.settings).toMatchObject({ template: "ats-classic", language });
    expect(resume.experience).toHaveLength(1);
    expect(resume.projects).toHaveLength(2);
    expect(resume.certifications).toHaveLength(2);
    expect(resume.certifications[0].period).toContain(language === "ar" ? "أكتوبر 2024" : "Oct 2024");
    expect(resume.skills).toHaveLength(8);
    expect(resume.projects[0].achievements).toHaveLength(2);
  });
});

test.each([
  ["العربية", "نظمت بيانات  التدريب وكتبت تقريرًا "],
  ["English", "Prepared weekly  training reports "],
])("%s training bullet accepts natural spaces during typing", async (language, sentence) => {
  render(<ExperienceRewardResumePage />);
  fireEvent.click(await screen.findByText(language));
  const row = screen.getByPlaceholderText("نقطة 1");
  fireEvent.change(row, { target: { value: sentence } });
  expect(row).toHaveValue(sentence);
  fireEvent.blur(row);
  expect(row).toHaveValue(sentence.trim());
});

test.each([
  ["university", "الجامعة"], ["major", "التخصص"],
  ["graduationYear", "سنة التخرج"], ["educationCity", "مدينة الجامعة"],
])("%s is required before finalization", async (field, label) => {
  axios.get.mockResolvedValueOnce({ data: { reward: { status: "available", v11Enabled: true, language: null },
    prefill: { ...prefill, [field]: "" } } });
  render(<ExperienceRewardResumePage />);
  fireEvent.click(await screen.findByText("العربية"));
  fireEvent.click(screen.getByText("اعتماد وإنشاء السيرة الذاتية"));
  expect(screen.getByRole("status")).toHaveTextContent(label);
  expect(axios.post).not.toHaveBeenCalled();
});

test("skill, language and project tool chips accept multiple values", async () => {
  render(<ExperienceRewardResumePage />);
  fireEvent.click(await screen.findByText("العربية"));
  const skill = screen.getByPlaceholderText("أضف مهارة ثم Enter");
  fireEvent.change(skill, { target: { value: "Power BI" } });
  fireEvent.keyDown(skill, { key: "Enter" });
  expect(screen.getByText("Power BI")).toBeInTheDocument();
  const language = screen.getByPlaceholderText("أضف لغة ثم Enter");
  fireEvent.change(language, { target: { value: "الإنجليزية" } });
  fireEvent.keyDown(language, { key: "Enter" });
  expect(screen.getByText("الإنجليزية")).toBeInTheDocument();
  fireEvent.click(screen.getByText("إضافة المشاريع"));
  const tool = screen.getByPlaceholderText("اكتب أداة ثم Enter");
  fireEvent.change(tool, { target: { value: "Figma" } });
  fireEvent.keyDown(tool, { key: "Enter" });
  expect(screen.getByText("Figma")).toBeInTheDocument();
});

test("conversational experience is reference only and never copied into PDF", async () => {
  axios.get.mockResolvedValueOnce({ data: { reward: { status: "available", v11Enabled: true, language: null },
    prefill: { ...prefill, trainingExperience: [{ ...prefill.trainingExperience[0], description: "" }] },
    sourceNarrative: "كانت تجربتي جميلة جدًا وساعدني الفريق كثيرًا" } });
  render(<ExperienceRewardResumePage />);
  fireEvent.click(await screen.findByText("العربية"));
  expect(screen.getByPlaceholderText("نقطة 1")).toHaveValue("");
  fireEvent.click(screen.getByText("عرض وصف تجربتك للرجوع إلى الوقائع"));
  expect(screen.getByText("كانت تجربتي جميلة جدًا وساعدني الفريق كثيرًا")).toBeInTheDocument();
  fireEvent.click(screen.getByText("معاينة السيرة"));
  await waitFor(() => expect(pdf).toHaveBeenCalled());
  expect(JSON.stringify(pdf.mock.calls[0][0].props.resume)).not.toContain("كانت تجربتي جميلة جدًا");
});

test("single AI suggestion can be edited and never finalizes the reward", async () => {
  axios.post.mockResolvedValueOnce({ data: { suggestion: {
    professionalSummary: "متخصص في تقنية المعلومات مع خبرة تدريبية في إعداد التقارير.",
    trainingBullets: ["أعددت تقارير التدريب", "نظمت بيانات الفريق"],
  } } });
  render(<ExperienceRewardResumePage />);
  fireEvent.click(await screen.findByText("العربية"));
  fireEvent.click(screen.getByText("اقترح الصياغة مرة واحدة"));
  expect(await screen.findByDisplayValue("متخصص في تقنية المعلومات مع خبرة تدريبية في إعداد التقارير.")).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("نقطة 1"), { target: { value: "أعددت تقارير أسبوعية" } });
  expect(screen.getByPlaceholderText("نقطة 1")).toHaveValue("أعددت تقارير أسبوعية");
  expect(screen.getByText("اقترح الصياغة مرة واحدة")).toBeDisabled();
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post.mock.calls[0][0]).toContain("/api/rewards/resume/suggest");
});

test("manual edits to an AI suggestion persist in the server draft", async () => {
  let savedDraft = null;
  axios.put.mockImplementation(async (_, body) => {
    savedDraft = body.draft;
    return { data: { language: body.language, draft: body.draft } };
  });
  axios.post.mockResolvedValueOnce({ data: { suggestion: {
    professionalSummary: "نبذة مقترحة", trainingBullets: ["أعددت تقريرًا"],
  } } });
  render(<ExperienceRewardResumePage />);
  fireEvent.click(await screen.findByText("العربية"));
  fireEvent.click(screen.getByText("اقترح الصياغة مرة واحدة"));
  await screen.findByDisplayValue("نبذة مقترحة");
  fireEvent.change(document.querySelector(".experience-reward-page textarea"),
    { target: { value: "نبذة مهنية عدلتها بنفسي" } });
  fireEvent.change(screen.getByPlaceholderText("نقطة 1"),
    { target: { value: "أعددت تقريرًا أسبوعيًا" } });
  fireEvent.blur(screen.getByPlaceholderText("نقطة 1"));
  await waitFor(() => expect(savedDraft?.professionalSummary).toBe("نبذة مهنية عدلتها بنفسي"));
  expect(savedDraft.trainingExperience[0].description).toBe("أعددت تقريرًا أسبوعيًا");
  expect(axios.post).toHaveBeenCalledTimes(1);
});

test("AI failure leaves manual builder and preview available", async () => {
  axios.post.mockRejectedValueOnce({ response: { status: 503, data: { error: "تعذر الاقتراح" } } });
  render(<ExperienceRewardResumePage />);
  fireEvent.click(await screen.findByText("العربية"));
  fireEvent.click(screen.getByText("اقترح الصياغة مرة واحدة"));
  expect(await screen.findByText("تعذر الاقتراح")).toBeInTheDocument();
  fireEvent.click(screen.getByText("معاينة السيرة"));
  await waitFor(() => expect(pdf).toHaveBeenCalledTimes(1));
  expect(screen.getByText("اعتماد وإنشاء السيرة الذاتية")).toBeInTheDocument();
});
