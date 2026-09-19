import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ResumePreview from "./ResumePreview";
import { SettingsEditor } from "./ResumeBuilder";

jest.mock("@dnd-kit/react", () => ({
  DragDropProvider: ({ children }) => children,
}));
jest.mock("@dnd-kit/react/sortable", () => ({
  useSortable: () => ({ ref: jest.fn(), handleRef: jest.fn(), isDragging: false }),
}));
jest.mock("@dnd-kit/helpers", () => ({ move: (items) => items }));
jest.mock("./RichAchievementEditor", () => () => null);
jest.mock("./ResumeEducationFactsEditor", () => () => null);

const resume = {
  personalInfo: {
    fullName: "Rahaf Alqahtani",
    headline: "Information Systems Student",
    email: "rahaf@example.com",
    phone: "0501234567",
    city: "Riyadh",
  },
  summary: "Information Systems student with practical project experience.",
  education: [{ id: "education-1", title: "Bachelor's Degree in Information Systems" }],
  experience: [],
  projects: [{
    id: "project-1",
    title: "Sales Performance Dashboard",
    technologies: ["Power BI", "Microsoft Excel"],
    achievements: [{ id: "bullet-1", text: "Analyzed monthly sales data." }],
  }],
  skills: ["Power BI", "Microsoft Excel", "SQL"],
  certifications: [],
  volunteering: [],
  languages: [],
  hiddenSections: [],
  settings: {
    language: "en",
    direction: "ltr",
    template: "ats-classic",
  },
};

describe("Darbak ATS Classic preview", () => {
  test("renders a single-flow preview with plain contact, tools, and skills text", () => {
    const { container } = render(<ResumePreview resume={resume} />);

    expect(container.querySelector(".resume-paper.template-ats-classic.ats-density-short")).toBeTruthy();
    expect(screen.getByText("rahaf@example.com | 0501234567 | Riyadh")).toBeInTheDocument();
    expect(screen.getByText("Power BI, Microsoft Excel")).toBeInTheDocument();
    expect(screen.getByText("Microsoft Excel | Power BI | SQL")).toBeInTheDocument();
    expect(container.querySelector(".resume-paper-chips")).toBeNull();
  });

  test("offers ATS Classic as an independent template choice", () => {
    const onChange = jest.fn();
    render(<SettingsEditor resume={resume} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Darbak ATS Classic/ }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({ template: "ats-classic" }),
    }));
    expect(screen.getByText("موصى به لأنظمة ATS")).toBeInTheDocument();
    expect(screen.getByText("محسن للقراءة بواسطة أنظمة ATS")).toBeInTheDocument();
  });
});
