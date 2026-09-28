import { getResumeLanguageDisplay } from "./resumeLanguageDisplay";

describe("resume language display", () => {
  it("localizes known language labels for Arabic display without changing source values", () => {
    const source = { name: "Arabic", level: "Native" };
    expect(getResumeLanguageDisplay(source, "ar")).toEqual({
      name: "العربية",
      level: "اللغة الأم",
    });
    expect(source).toEqual({ name: "Arabic", level: "Native" });
  });

  it("uses English labels for English display", () => {
    expect(getResumeLanguageDisplay({ name: "الإنجليزية", level: "متقدم" }, "en")).toEqual({
      name: "English",
      level: "Advanced",
    });
  });
});
