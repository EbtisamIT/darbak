import { getCompanySeo } from "./companySeo";

describe("company profile SEO module", () => {
  it("loads through the frontend module boundary and builds the company path", () => {
    expect(getCompanySeo({ nameAr: "أرامكو السعودية", slug: "aramco" }, {
      experiencesCount: 3,
    })).toEqual(expect.objectContaining({
      name: "أرامكو السعودية",
      path: "/companies/aramco",
      title: expect.stringContaining("أرامكو السعودية"),
      description: expect.stringContaining("3 تجربة تدريب"),
    }));
  });
});
