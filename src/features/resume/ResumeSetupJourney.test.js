import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ResumeSetupJourney, { RESUME_SETUP_STEPS } from "./ResumeSetupJourney";

jest.mock("./ResumeBuilder", () => ({ visibleSections, showPersonalInfo }) => (
  <div data-testid="setup-editor">
    {showPersonalInfo ? "personal" : (visibleSections || []).join(",")}
  </div>
));

describe("resume setup journey", () => {
  it("keeps setup navigation separate and builds only from the explicit final CTA", async () => {
    window.scrollTo = jest.fn();
    const onAutosave = jest.fn().mockResolvedValue(true);
    const onBuild = jest.fn();
    render(
      <ResumeSetupJourney
        resume={{ personalInfo: {}, education: [], experience: [], projects: [], skills: [], certifications: [], volunteering: [] }}
        onChange={jest.fn()}
        onAutosave={onAutosave}
        onBuild={onBuild}
      />,
    );

    expect(screen.getByTestId("setup-editor")).toHaveTextContent("personal");
    expect(onBuild).not.toHaveBeenCalled();

    for (let index = 1; index < RESUME_SETUP_STEPS.length; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: /التالي/ }));
      await waitFor(() => expect(
        screen.getByRole("button", { name: RESUME_SETUP_STEPS[index].label }),
      ).toHaveClass("is-current"));
    }

    expect(onAutosave).toHaveBeenCalledTimes(RESUME_SETUP_STEPS.length - 1);
    expect(onBuild).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /ابنِ سيرتي/ }));
    expect(onBuild).toHaveBeenCalledTimes(1);
  });
});
