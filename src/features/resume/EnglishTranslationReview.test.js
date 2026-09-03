import {
  applyEnglishReviewGroup,
  getEnglishReviewGroups,
} from "./EnglishTranslationReview";

jest.mock("./resumeLocalization", () => ({
  getEnglishReviewItems: jest.fn(),
}));

const { getEnglishReviewItems } = require("./resumeLocalization");

const reviewItems = [
  {
    section: "projects",
    entryId: "project-1",
    field: "title",
    fieldKey: "projects.project-1.title",
    value: "نظام حجز مواعيد",
    generatedValue: "Appointment Booking System",
    label: "ترجمة الاسم",
  },
  {
    section: "certifications",
    entryId: "cert-1",
    field: "title",
    fieldKey: "certifications.cert-1.title",
    value: "إدارة المشاريع",
    generatedValue: "Project Management",
    label: "ترجمة الاسم",
  },
  {
    section: "volunteering",
    entryId: "activity-1",
    field: "title",
    fieldKey: "volunteering.activity-1.title",
    value: "نادي التقنية",
    generatedValue: "Technology Club",
    label: "ترجمة الاسم",
  },
  {
    section: "personal",
    field: "major",
    fieldKey: "personal.major",
    value: "علوم الحاسب",
    generatedValue: "Computer Science",
  },
];

describe("English translation review state", () => {
  beforeEach(() => {
    getEnglishReviewItems.mockImplementation((resume = {}) => reviewItems.filter((item) => {
      const entryKey = `${item.section}:${item.entryId}`;
      const key = item.field === "achievement"
        ? `achievements:${entryKey}:${item.achievementId || item.index}`
        : `entries:${entryKey}:${item.field}`;
      return !resume.localizedDisplay?.review?.[key]?.approved;
    }));
  });

  test("groups only user-specific items and tracks three approvals", () => {
    const groups = getEnglishReviewGroups({});

    expect(groups).toHaveLength(3);
    expect(groups.every((group) => group.status === "pending")).toBe(true);

    const afterFirst = applyEnglishReviewGroup({}, groups[0]);
    const afterFirstGroups = getEnglishReviewGroups(afterFirst);
    expect(afterFirstGroups.filter((group) => group.status !== "pending")).toHaveLength(1);

    const afterAll = afterFirstGroups
      .filter((group) => group.status === "pending")
      .reduce((current, group) => applyEnglishReviewGroup(current, group), afterFirst);
    expect(getEnglishReviewGroups(afterAll).every((group) => group.status !== "pending")).toBe(true);
  });

  test("an edited approval persists the English value and status", () => {
    const group = getEnglishReviewGroups({})[0];
    const next = applyEnglishReviewGroup({}, group, {
      "projects.project-1.title": "Appointments Platform",
    }, "edited_and_approved");

    expect(next.localizedDisplay.entries["projects:project-1"].title).toBe("Appointments Platform");
    expect(next.localizedDisplay.review["groups:projects:project-1"].status).toBe("edited_and_approved");
    expect(getEnglishReviewGroups(next).find((candidate) => candidate.key === group.key).status).toBe("edited_and_approved");
  });
});
