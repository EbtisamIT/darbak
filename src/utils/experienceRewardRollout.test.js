import { canShowExperienceReward } from "./experienceRewardRollout";
import { getStoredAccessIdentity } from "./premiumAccess";

jest.mock("./premiumAccess", () => ({
  getAccessHeaders: jest.fn(() => ({})),
  getStoredAccessIdentity: jest.fn(() => ({})),
}));
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; sessionStorage.clear(); });

test("QA rollout hides new journey from ordinary account and guest", async () => {
  getStoredAccessIdentity.mockReturnValue({});
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: false, mode: "qa" }) });
  expect(await canShowExperienceReward()).toBe(false);
  getStoredAccessIdentity.mockReturnValue({ contact: "other@example.com", accessCode: "ABCD1234" });
  expect(await canShowExperienceReward()).toBe(false);
});

test("QA can preview guest entry in the same session after authenticating", async () => {
  getStoredAccessIdentity.mockReturnValue({ contact: "qa@example.com", accessCode: "ABCD1234" });
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: true, mode: "qa" }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: false, mode: "qa" }) });
  expect(await canShowExperienceReward()).toBe(true);
  getStoredAccessIdentity.mockReturnValue({});
  expect(await canShowExperienceReward()).toBe(true);
});

test("global rollout enables guest entry, unavailable API fails closed", async () => {
  getStoredAccessIdentity.mockReturnValue({});
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: true, mode: "all" }) })
    .mockRejectedValueOnce(new Error("offline"));
  expect(await canShowExperienceReward()).toBe(true);
  expect(await canShowExperienceReward()).toBe(false);
});
