import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("./ResumeBuilder", () => ({
  ApplicationDetailsEditor: () => null,
  PersonalInfoEditor: () => null,
}));

import { ResumeJourneyMissing, ResumeJourneyStepper } from "./ResumeJourney";

const emptyResume = {
  personalInfo: {
    phone: "",
    headline: "",
  },
};

const MissingJourneyHarness = ({ onContinue, onAutosave = () => {} }) => {
  const [resume, setResume] = useState(emptyResume);
  return (
    <ResumeJourneyMissing
      resume={resume}
      onChange={setResume}
      onBack={() => {}}
      onContinue={onContinue}
      onAutosave={onAutosave}
    />
  );
};

const BackJourneyHarness = () => {
  const [resume, setResume] = useState(emptyResume);
  const [showMissing, setShowMissing] = useState(true);
  return showMissing ? (
    <ResumeJourneyMissing
      resume={resume}
      onChange={setResume}
      onBack={() => setShowMissing(false)}
      onContinue={() => {}}
    />
  ) : (
    <button type="button" onClick={() => setShowMissing(true)}>العودة للناقص</button>
  );
};

describe("ResumeJourneyMissing", () => {
  it("keeps the current step and all inputs after typing the first character", () => {
    const onContinue = jest.fn();
    render(<MissingJourneyHarness onContinue={onContinue} />);

    fireEvent.change(screen.getByLabelText("رقم التواصل"), { target: { value: "0" } });

    expect(screen.getByLabelText("رقم التواصل")).toHaveValue("0");
    expect(screen.getByLabelText("المسمى المهني")).toBeInTheDocument();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("continues only after all step fields are filled and the explicit CTA is pressed", () => {
    const onContinue = jest.fn();
    render(<MissingJourneyHarness onContinue={onContinue} />);

    fireEvent.change(screen.getByLabelText("رقم التواصل"), { target: { value: "0500000000" } });
    fireEvent.change(screen.getByLabelText("المسمى المهني"), { target: { value: "متخصصة تقنية معلومات" } });

    expect(onContinue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "حفظ والمتابعة للمسودة" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue.mock.calls[0][0].personalInfo).toEqual({
      phone: "0500000000",
      headline: "متخصصة تقنية معلومات",
    });
  });

  it("autosaves on blur without advancing the step", () => {
    const onContinue = jest.fn();
    const onAutosave = jest.fn();
    render(<MissingJourneyHarness onContinue={onContinue} onAutosave={onAutosave} />);

    fireEvent.change(screen.getByLabelText("رقم التواصل"), { target: { value: "0" } });
    fireEvent.blur(screen.getByLabelText("رقم التواصل"));

    expect(onAutosave).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByText("المرحلة الثانية من خمس")).toBeInTheDocument();
  });

  it("keeps typed values when the student goes back and reopens the step", () => {
    render(<BackJourneyHarness />);

    fireEvent.change(screen.getByLabelText("رقم التواصل"), { target: { value: "0500000000" } });
    fireEvent.click(screen.getByRole("button", { name: "رجوع" }));
    fireEvent.click(screen.getByRole("button", { name: "العودة للناقص" }));

    expect(screen.getByText("رقم التواصل ✓")).toBeInTheDocument();
  });

  it("allows only completed steps to be selected", () => {
    const onStepChange = jest.fn();
    render(<ResumeJourneyStepper currentStep="missing" completedSteps={["data"]} onStepChange={onStepChange} />);

    fireEvent.click(screen.getByRole("button", { name: "بياناتك" }));
    expect(onStepChange).toHaveBeenCalledWith("data");
    expect(screen.getByRole("button", { name: "3 مسودتك الذكية" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "5 جاهزة للتقديم" })).toBeDisabled();
  });
});
