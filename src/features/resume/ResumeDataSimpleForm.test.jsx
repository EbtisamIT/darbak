import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ResumeDataSimpleForm from "./ResumeDataSimpleForm";
import { normalizeResume } from "./resumeDefaults";

const Harness = ({ initial }) => {
  const [resume, setResume] = useState(normalizeResume(initial));
  return <><ResumeDataSimpleForm resume={resume} onChange={setResume} /><output data-testid="state">{JSON.stringify(resume)}</output></>;
};

describe("simplified Resume Data form", () => {
  it("shows education and existing facts directly without accordions", () => {
    render(<Harness initial={{ personalInfo: { major: "نظم المعلومات الإدارية", university: "جامعة جدة", degree: "بكالوريوس", studentStatus: "student" } }} />);
    expect(screen.getByDisplayValue("نظم المعلومات الإدارية")).toHaveAttribute("list", "resume-major-options");
    expect(screen.getByDisplayValue("جامعة جدة")).toBeInTheDocument();
    expect(screen.getByDisplayValue("بكالوريوس")).toBeInTheDocument();
    expect(screen.queryByText("المسمى أو التخصص")).not.toBeInTheDocument();
  });

  it("stores project detail as student-owned source data so enrichment does not repeat it", () => {
    render(<Harness initial={{ projects: [{ id: "project-1", title: "تحليل رضا العملاء" }] }} />);
    fireEvent.change(screen.getByLabelText("وش سويت في المشروع؟"), { target: { value: "حللت الاستبيان وصنفت أسباب عدم الرضا" } });
    expect(screen.getByTestId("state")).toHaveTextContent("userSourceDescription");
    expect(screen.getByTestId("state")).toHaveTextContent("حللت الاستبيان وصنفت أسباب عدم الرضا");
  });

  it("keeps skills as separate tags", () => {
    render(<Harness initial={{ skills: ["Power BI"] }} />);
    fireEvent.change(screen.getByPlaceholderText("أضف مهارة"), { target: { value: "Microsoft Excel" } });
    fireEvent.click(screen.getAllByRole("button", { name: "إضافة" }).slice(-1)[0]);
    expect(screen.getByRole("button", { name: /Microsoft Excel/ })).toBeInTheDocument();
  });
});
