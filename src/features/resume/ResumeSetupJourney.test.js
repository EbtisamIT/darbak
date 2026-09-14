import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ResumeSetupJourney from "./ResumeSetupJourney";

jest.mock("./ResumeDataSimpleForm", () => () => (
  <div data-testid="simple-resume-form">كل الأقسام</div>
));

describe("resume setup journey", () => {
  it("shows one compact form and builds only from the explicit CTA", async () => {
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

    expect(screen.getByTestId("simple-resume-form")).toBeInTheDocument();
    expect(screen.getByText(/كل الأقسام أمامك في صفحة واحدة/)).toBeInTheDocument();
    expect(onBuild).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /ابنِ سيرتي/ }));
    await waitFor(() => expect(onAutosave).toHaveBeenCalledTimes(1));
    expect(onBuild).toHaveBeenCalledTimes(1);
  });

  it("does not build when the latest facts cannot be saved", async () => {
    const onBuild = jest.fn();
    render(<ResumeSetupJourney resume={{ personalInfo: {} }} onChange={jest.fn()} onAutosave={jest.fn().mockResolvedValue(false)} onBuild={onBuild} />);
    fireEvent.click(screen.getByRole("button", { name: /ابنِ سيرتي/ }));
    await waitFor(() => expect(onBuild).not.toHaveBeenCalled());
  });
});
