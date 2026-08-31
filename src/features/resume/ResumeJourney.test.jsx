import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("./ResumeBuilder", () => ({
  ApplicationDetailsEditor: () => null,
  PersonalInfoEditor: () => null,
}));

import { ResumeJourneyMissing } from "./ResumeJourney";

const emptyResume = {
  personalInfo: {
    phone: "",
    headline: "",
  },
};

const MissingJourneyHarness = ({ onContinue }) => {
  const [resume, setResume] = useState(emptyResume);
  return (
    <ResumeJourneyMissing
      resume={resume}
      onChange={setResume}
      onBack={() => {}}
      onContinue={onContinue}
    />
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
});
