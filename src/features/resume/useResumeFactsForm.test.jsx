import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import axios from "axios";
import useResumeFactsForm from "./useResumeFactsForm";
import { prepareResumeFactsForSave } from "./resumeFactsForm";

jest.mock("axios", () => ({ get: jest.fn(), put: jest.fn() }));
jest.mock("../../utils/premiumAccess", () => ({ getAccessHeaders: () => ({}) }));
const facts = { personalInfo: { city: "الخبر" }, projects: [{ id: "p", title: "مشروع", userSourceDescription: "سويت واجهة" }] };
const response = { data: { facts, version: "v1" } };
const onError = jest.fn();
let currentForm;
function Harness({ cycle = "review", active = true }) {
  const form = useResumeFactsForm({ cycleKey: cycle, active, onError });
  currentForm = form;
  return <><pre>{JSON.stringify(form.facts)}</pre><input aria-label="city" value={form.facts.personalInfo.city || ""} onChange={(event) => form.edit({ ...form.facts, personalInfo: { ...form.facts.personalInfo, city: event.target.value } })} /></>;
}
const tick = async (ms = 2000) => act(async () => { jest.advanceTimersByTime(ms); });
describe("source facts hydration authority", () => {
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks();
    axios.get.mockResolvedValue(response);
    axios.put.mockResolvedValue({ data: { version: "v2" } });
  });
  afterEach(() => jest.useRealTimers());

  it("strips nested presentation and does not synthesize source fields from it", () => {
    const dto = prepareResumeFactsForSave({
      summary: "English summary", personalInfo: { fullName: "Test", headline: "Generated" },
      projects: [{ id: "p", title: "Project", description: "English", achievements: [{ text: "English" }], localizedDisplay: {}, userSourceDescription: "سويت واجهة" }],
      localizedDisplay: {}, workflow: {},
    });
    expect(dto.projects).toEqual([{ id: "p", title: "Project", userSourceDescription: "سويت واجهة" }]);
    expect(dto.personalInfo).toEqual({ fullName: "Test" });
    expect(dto.summary).toBeUndefined();
  });
  it("cancels a debounced user edit when a new hydration cycle begins", async () => {
    let app;
    await act(async () => { app = render(<Harness />); });
    fireEvent.change(screen.getByLabelText("city"), { target: { value: "جدة" } });
    await tick(400);
    let resolveRead;
    axios.get.mockImplementationOnce(() => new Promise((resolve) => { resolveRead = resolve; }));
    await act(async () => { app.rerender(<Harness cycle="new-review" />); });
    fireEvent.change(screen.getByLabelText("city"), { target: { value: "English stale state" } });
    await tick();
    expect(axios.put).not.toHaveBeenCalled();
    await act(async () => { resolveRead(response); });
    await tick();
    expect(screen.getByLabelText("city")).toHaveValue("الخبر");
    expect(axios.put).not.toHaveBeenCalled();
  });
  it("ignores out-of-order hydration and late save responses; queued saves lose authority", async () => {
    let app;
    await act(async () => { app = render(<Harness />); });
    let resolveSave;
    axios.put.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    fireEvent.change(screen.getByLabelText("city"), { target: { value: "جدة" } });
    await tick(1000);
    let queued;
    await act(async () => { queued = currentForm.save(); app.rerender(<Harness cycle="new-session" />); });
    await act(async () => { resolveSave({ data: { version: "old-session" } }); await queued; });
    await tick();
    expect(axios.put).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("city")).toHaveValue("الخبر");
    expect(currentForm.userDirty).toBe(false);
    let resolveOldRead;
    axios.get.mockImplementationOnce(() => new Promise((resolve) => { resolveOldRead = resolve; }));
    await act(async () => { app.rerender(<Harness cycle="slow" />); });
    await act(async () => { app.rerender(<Harness cycle="latest" />); });
    await act(async () => { resolveOldRead({ data: { facts: { personalInfo: { city: "Old" } }, version: "old" } }); });
    expect(screen.getByLabelText("city")).toHaveValue("الخبر");
  });
  it("explicit save plus debounce produces one request; repeated clean saves produce zero", async () => {
    await act(async () => { render(<Harness />); });
    await act(async () => { await currentForm.save(); });
    expect(axios.put).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("city"), { target: { value: "جدة" } });
    await act(async () => { await Promise.all([currentForm.save(), currentForm.save()]); });
    await tick(5000);
    expect(axios.put).toHaveBeenCalledTimes(1);
    expect(axios.put.mock.calls[0][1]).toEqual({ personalInfo: { city: "جدة" } });
  });
  it("a failed facts read does not fall back to preview or enable editing/saving", async () => {
    axios.get.mockRejectedValueOnce(new Error("network"));
    await act(async () => { render(<Harness />); });
    fireEvent.change(screen.getByLabelText("city"), { target: { value: "English" } });
    await act(async () => { await currentForm.save(); });
    await tick();
    expect(currentForm.isHydrating).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(axios.put).not.toHaveBeenCalled();
  });
});
