import {
  buildEmailApplicationHref,
  getApplicationEmail,
  getEmailApplicationMessage,
  getEmailApplicationSubject,
  isEmailApplication,
} from "./emailApplication";

test("email address is validated from structured fields or mailto URL", () => {
  expect(getApplicationEmail({ applicationMethod: "email", applicationUrl: "mailto:apply@example.com?subject=Old" })).toBe("apply@example.com");
  expect(getApplicationEmail({ applicationEmail: "invalid address", applicationUrl: "mailto:bad address" })).toBe("");
  expect(isEmailApplication({ applicationMethod: "email" })).toBe(true);
  expect(isEmailApplication({ applicationUrl: "https://example.com/apply" })).toBe(false);
});

test("subject and message use the title only when meaningful", () => {
  expect(getEmailApplicationSubject({ title: "محلل بيانات متدرب", organizationName: "شركة ألف" }))
    .toBe("التقديم على فرصة التدريب التعاوني – محلل بيانات متدرب");
  expect(getEmailApplicationSubject({ title: "تدريب تعاوني", organizationName: "شركة ألف" }))
    .toBe("طلب تدريب تعاوني – شركة ألف");
  expect(getEmailApplicationMessage({ organizationName: "شركة ألف" }, "سارة"))
    .toContain("لدى شركة ألف.\n\nأرفقت");
  expect(getEmailApplicationMessage({ organizationName: "شركة ألف" }, "سارة")).toMatch(/شكرًا لكم،\nسارة$/);
});

test("mailto encodes recipient, subject and edited multiline body", () => {
  const href = buildEmailApplicationHref({ email: "apply@example.com", subject: "تدريب – الرياض", body: "سطر أول\nسطر ثان" });
  expect(href).toContain("mailto:apply@example.com?");
  expect(new URL(href).searchParams.get("subject")).toBe("تدريب – الرياض");
  expect(new URL(href).searchParams.get("body")).toBe("سطر أول\nسطر ثان");
});
