import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import EducationFactsEditor from "./ResumeEducationFactsEditor";

const renderEditor = (personalInfo = {}) => {
  const resume = { personalInfo, education: [] };
  const onChange = jest.fn();
  render(<EducationFactsEditor resume={resume} onChange={onChange} />);
  return { resume, onChange };
};

describe("resume education facts editor", () => {
  it("shows expected graduation for a student", () => {
    renderEditor({ studentStatus: "student", expectedGraduationYear: "2027" });
    expect(screen.getByLabelText("سنة التخرج المتوقعة")).toHaveValue("2027");
    expect(screen.queryByLabelText("سنة التخرج")).not.toBeInTheDocument();
  });

  it("shows graduation year for a graduate", () => {
    renderEditor({ studentStatus: "graduate", graduationYear: "2026" });
    expect(screen.getByLabelText("سنة التخرج")).toHaveValue("2026");
  });

  it("preserves GPA and scale edits in the resume payload", () => {
    const { onChange } = renderEditor({ gpa: "4.5", gpaScale: "5" });
    fireEvent.change(screen.getByPlaceholderText("مثال: 4.70"), { target: { value: "4.7" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      personalInfo: expect.objectContaining({ gpa: "4.7", gpaScale: "5" }),
    }));
    fireEvent.change(screen.getByLabelText("مقياس المعدل"), { target: { value: "4" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      personalInfo: expect.objectContaining({ gpa: "4.5", gpaScale: "4" }),
    }));
  });

  it("restores coursework and supports adding another course without AI", () => {
    const { onChange } = renderEditor({ relevantCoursework: ["قواعد البيانات"] });
    expect(screen.getByDisplayValue("قواعد البيانات")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /إضافة مقرر/ }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      personalInfo: expect.objectContaining({ relevantCoursework: ["قواعد البيانات", ""] }),
    }));
  });

  it("lets an old account explicitly confirm that it has no academic track", () => {
    const { onChange } = renderEditor({ academicTrack: "" });
    fireEvent.change(screen.getByLabelText(/هل عندك مسار أكاديمي/), { target: { value: "no_academic_track" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      personalInfo: expect.objectContaining({ academicTrack: "no_academic_track" }),
    }));
  });
});
