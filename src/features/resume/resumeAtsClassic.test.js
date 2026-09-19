import {
  ATS_CLASSIC_TEMPLATE,
  getAtsClassicDensityMetrics,
  getAtsClassicDensityMode,
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

  test("classifies short, medium, and long resumes deterministically", () => {
    const project = {
      id: "project-1",
      title: "Sales Dashboard",
      achievements: [
        { text: "Analyzed sales data." },
        { text: "Designed a dashboard." },
      ],
    };
    const shortResume = {
      summary: "Information Systems student with practical project experience.",
      education: [{ id: "education-1", title: "Bachelor's Degree in Information Systems" }],
      projects: [project],
      skills: ["Power BI", "Microsoft Excel", "SQL"],
      certifications: [{ id: "certification-1", title: "Data Analysis Fundamentals" }],
      volunteering: [{ id: "activity-1", title: "Club Member", description: "Organized a student event." }],
      languages: [{ id: "language-1", name: "Arabic", level: "Native" }],
    };
    const mediumResume = {
      ...shortResume,
      experience: [{
        id: "experience-1",
        title: "Business Analysis Intern",
        organization: "Example Company",
        achievements: [
          { text: "Reviewed operational reports and organized source data." },
          { text: "Documented findings for the weekly team review." },
        ],
      }],
    };
    const longResume = {
      ...mediumResume,
      experience: [
        ...mediumResume.experience,
        {
          id: "experience-2",
          title: "Data Operations Trainee",
          organization: "Second Company",
          achievements: Array.from({ length: 5 }, (_, index) => ({
            text: `Documented and reviewed operational data workflow number ${index + 1}.`,
          })),
        },
      ],
      projects: Array.from({ length: 4 }, (_, projectIndex) => ({
        id: `project-${projectIndex + 1}`,
        title: `Applied Project ${projectIndex + 1}`,
        achievements: Array.from({ length: 4 }, (_, bulletIndex) => ({
          text: `Completed a documented project responsibility ${bulletIndex + 1} for the applied solution.`,
        })),
      })),
    };

    expect(getAtsClassicDensityMode(shortResume)).toBe("short");
    expect(getAtsClassicDensityMode(mediumResume)).toBe("medium");
    expect(getAtsClassicDensityMode(longResume)).toBe("long");
    expect(getAtsClassicDensityMetrics(shortResume).score)
      .toBeLessThan(getAtsClassicDensityMetrics(mediumResume).score);
    expect(getAtsClassicDensityMetrics(mediumResume).score)
      .toBeLessThan(getAtsClassicDensityMetrics(longResume).score);
  });
});
