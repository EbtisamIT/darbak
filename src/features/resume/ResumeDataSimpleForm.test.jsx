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

  it("adds a suggested skill only after the student clicks it", () => {
    render(<Harness initial={{ personalInfo: { major: "نظم المعلومات" }, skills: [] }} />);
    expect(screen.getByTestId("state")).not.toHaveTextContent("تحليل البيانات");
    fireEvent.click(screen.getByRole("button", { name: "+ تحليل البيانات" }));
    expect(screen.getByTestId("state")).toHaveTextContent("تحليل البيانات");
  });

  it("keeps activity dates optional and persists the current flag", () => {
    render(<Harness initial={{ volunteering: [{ id: "activity-1", title: "نادي التقنية" }] }} />);
    fireEvent.click(screen.getAllByText("تفاصيل إضافية").slice(-1)[0]);
    fireEvent.click(screen.getByLabelText("حتى الآن"));
    expect(screen.getByTestId("state")).toHaveTextContent('"isCurrent":true');
  });

  it("shows expiry only for professional certifications", () => {
    render(<Harness initial={{ certifications: [{ id: "cert-1", entryType: "certification", title: "ITIL" }] }} />);
    expect(screen.getByText("تاريخ الانتهاء")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("شهادة مهنية"), { target: { value: "course" } });
    expect(screen.getByText("تاريخ الإكمال")).toBeInTheDocument();
    expect(screen.queryByText("تاريخ الانتهاء")).not.toBeInTheDocument();
  });
});
