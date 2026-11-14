import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import OpportunityClosedReport from "./OpportunityClosedReport";
import { trackEvent } from "../utils/analytics";

jest.mock("axios", () => ({ post: jest.fn() }));
jest.mock("../utils/analytics", () => ({
  getVisitorId: () => "visitor-test",
  trackEvent: jest.fn(),
}));

const opportunity = { _id: "6af3888a267f0cbc17ec7646", title: "تدريب تعاوني", organizationName: "STC" };

describe("OpportunityClosedReport", () => {
  beforeEach(() => {
    window.localStorage.clear();
    axios.post.mockReset();
    trackEvent.mockReset();
  });

  it("sends a report once and remembers it", async () => {
    axios.post.mockResolvedValue({ data: { status: "received" } });
    const { unmount } = render(<OpportunityClosedReport opportunity={opportunity} />);

    expect(screen.getByText("الفرصة منتهية؟")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "بلّغنا" }));

    expect(await screen.findByText("شكرًا، بنتحقق من الفرصة ✓")).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][0]).toMatch(/\/api\/opportunities\/6af3888a267f0cbc17ec7646\/closed-report$/);
    expect(axios.post.mock.calls[0][1]).toEqual({ visitorId: "visitor-test" });
    expect(trackEvent).toHaveBeenCalledWith("opportunity_closed_reported", expect.objectContaining({ opportunityId: opportunity._id }));

    unmount();
    render(<OpportunityClosedReport opportunity={opportunity} />);
    expect(screen.getByText("شكرًا، بنتحقق من الفرصة ✓")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lets the student retry after a failure", async () => {
    axios.post.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ data: { status: "received" } });
    render(<OpportunityClosedReport opportunity={opportunity} />);

    fireEvent.click(screen.getByRole("button", { name: "بلّغنا" }));
    fireEvent.click(await screen.findByRole("button", { name: "جرّب مرة ثانية" }));

    await waitFor(() => expect(screen.getByText("شكرًا، بنتحقق من الفرصة ✓")).toBeInTheDocument());
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it("is hidden for Darbak-hosted applications", () => {
    const { container } = render(<OpportunityClosedReport opportunity={{ ...opportunity, isDarbakApplication: true }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
