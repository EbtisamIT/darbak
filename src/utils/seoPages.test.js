import { buildExperienceSeo, toCanonicalPath, toCanonicalUrl } from "./seoPages.mjs";
import { setPageSeo } from "./seoMetadata";

const EXPERIENCE_ID = "6af3888a267f0cbc17ec7646";

describe("prerendered page canonical URLs", () => {
  it("adds a trailing slash to prerendered company and experience pages", () => {
    expect(toCanonicalPath("/companies/aramco")).toBe("/companies/aramco/");
    expect(toCanonicalPath("/companies/aramco/")).toBe("/companies/aramco/");
    expect(toCanonicalPath(`/experiences/${EXPERIENCE_ID}`)).toBe(`/experiences/${EXPERIENCE_ID}/`);
    expect(toCanonicalUrl("/companies/stc")).toBe("https://darbak.space/companies/stc/");
  });

  it("keeps listing and filter pages without a trailing slash", () => {
    expect(toCanonicalPath("/")).toBe("/");
    expect(toCanonicalPath("/companies")).toBe("/companies");
    expect(toCanonicalPath("/companies/")).toBe("/companies");
    expect(toCanonicalPath("/experiences/")).toBe("/experiences");
    expect(toCanonicalPath("/experiences/city/riyadh")).toBe("/experiences/city/riyadh");
    expect(toCanonicalPath("/experiences/not-an-id")).toBe("/experiences/not-an-id");
    expect(toCanonicalPath("/companies/aramco/reviews")).toBe("/companies/aramco/reviews");
  });

  it("writes the trailing-slash canonical into the document head", () => {
    document.head.innerHTML = '<link rel="canonical" href="https://darbak.space/" /><meta property="og:url" content="" />';
    setPageSeo({ title: "أرامكو", path: "/companies/aramco" });
    expect(document.querySelector('link[rel="canonical"]').getAttribute("href")).toBe(
      "https://darbak.space/companies/aramco/"
    );
    expect(document.querySelector('meta[property="og:url"]').getAttribute("content")).toBe(
      "https://darbak.space/companies/aramco/"
    );
  });
});

describe("experience SEO", () => {
  it("builds a specific title, description and path from public fields", () => {
    const seo = buildExperienceSeo({
      _id: EXPERIENCE_ID,
      title: "تجربتي في مدارس القلم الاهلية بـالرياض",
      organizationName: "مدارس القلم الاهلية",
      city: "الرياض",
      major: "الخدمة الاجتماعية",
    });
    expect(seo).toEqual(expect.objectContaining({
      title: "تجربتي في مدارس القلم الاهلية بـالرياض",
      path: `/experiences/${EXPERIENCE_ID}`,
      description: expect.stringContaining("بمدينة الرياض"),
    }));
    expect(seo.description).toContain("الخدمة الاجتماعية");
  });

  it("falls back to the major category and a generic title when data is missing", () => {
    expect(buildExperienceSeo({ _id: EXPERIENCE_ID, organizationName: "STC", major: "-", majorCategory: "الحاسب" }))
      .toEqual(expect.objectContaining({ title: "تجربة تدريب في STC", description: expect.stringContaining("الحاسب") }));
    expect(buildExperienceSeo({ _id: EXPERIENCE_ID }).title).toBe("تجربة تدريب تعاوني");
    expect(buildExperienceSeo({}).path).toBe("/experiences");
  });
});
