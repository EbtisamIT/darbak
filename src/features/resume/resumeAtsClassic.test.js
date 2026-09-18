import {
  ATS_CLASSIC_TEMPLATE,
  getAtsClassicSectionOrder,
  getResumeEntryTools,
  isAtsClassicTemplate,
} from "./resumeAtsClassic";
import { normalizeResume } from "./resumeDefaults";

describe("Darbak ATS Classic template", () => {
  test("is preserved as an independent saved template", () => {
    const resume = normalizeResume({ settings: { template: ATS_CLASSIC_TEMPLATE } });

    expect(resume.settings.template).toBe(ATS_CLASSIC_TEMPLATE);
    expect(isAtsClassicTemplate(resume)).toBe(true);
  });

  test("puts education and projects before skills for a student without experience", () => {
    expect(getAtsClassicSectionOrder({ experience: [] })).toEqual([
      "summary",
      "education",
      "projects",
      "skills",
      "certifications",
      "volunteering",
      "languages",
    ]);
  });

  test("puts real experience before education without rendering empty sections", () => {
    expect(getAtsClassicSectionOrder({
      experience: [{ id: "experience-1", title: "Accounting Intern" }],
      hiddenSections: ["volunteering"],
    })).toEqual([
      "summary",
      "experience",
      "education",
      "projects",
      "skills",
      "certifications",
      "languages",
    ]);
  });

  test("keeps verified project tools as deduplicated plain text values", () => {
    expect(getResumeEntryTools({
      tools: ["Power BI", "Microsoft Excel"],
      technologies: ["Power BI", "SQL"],
    })).toEqual(["Power BI", "Microsoft Excel", "SQL"]);
  });
});
