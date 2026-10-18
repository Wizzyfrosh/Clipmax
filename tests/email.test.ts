import { afterEach, expect, it, vi } from "vitest";
import { sendAuthEmail, sendVerificationCodeEmail } from "../src/lib/email";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("sends verification/reset mail through Brevo with the configured sender", async () => {
  vi.stubEnv("BREVO_API_KEY", "test-key");
  vi.stubEnv("EMAIL_FROM", "Clipmax <hello@example.test>");
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  await sendAuthEmail(
    "user@example.test",
    "Verify",
    "https://example.test/verify?token=test",
  );
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.brevo.com/v3/smtp/email");
  expect(options.headers["api-key"]).toBe("test-key");
  expect(JSON.parse(options.body)).toMatchObject({
    sender: { name: "Clipmax", email: "hello@example.test" },
    to: [{ email: "user@example.test" }],
    subject: "Verify",
  });
  expect(JSON.parse(options.body).textContent).toContain(
    "https://example.test/verify?token=test",
  );
});
it("rejects provider failures instead of reporting delivery success", async () => {
  vi.stubEnv("BREVO_API_KEY", "test-key");
  vi.stubEnv("EMAIL_FROM", "hello@example.test");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
  );
  await expect(
    sendAuthEmail("user@example.test", "Reset", "https://example.test/reset"),
  ).rejects.toThrow("EMAIL_DELIVERY_FAILED");
});

it("sends branded OTP email with both HTML and text and does not embed verification links", async () => {
  vi.stubEnv("BREVO_API_KEY", "test-key");
  vi.stubEnv("EMAIL_FROM", "account@clipmax.froshcodeorbit.site");
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  await sendVerificationCodeEmail("new@example.test", "048216");
  const email = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(email.to).toEqual([{ email: "new@example.test" }]);
  expect(email.sender.email).toBe("account@clipmax.froshcodeorbit.site");
  expect(email.subject).toContain("verification code");
  expect(email.htmlContent).toContain("048216");
  expect(email.textContent).toContain("048216");
  expect(email.textContent).not.toMatch(/https?:\/\//);
});
it("returns a send error for API rejection without including a private code in logs", async () => {
  vi.stubEnv("BREVO_API_KEY", "test-key");
  vi.stubEnv("EMAIL_FROM", "account@clipmax.froshcodeorbit.site");
  const logs = vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
  try {
    await expect(sendVerificationCodeEmail("new@example.test", "123456")).rejects.toThrow("EMAIL_DELIVERY_FAILED");
    expect(logs).toHaveBeenCalledWith("BREVO_DELIVERY_REJECTED", { status: 403 });
    expect(JSON.stringify(logs.mock.calls)).not.toContain("123456");
  } finally {
    logs.mockRestore();
  }
});

it("logs only Brevo acceptance status, never the one-time code or recipient", async () => {
  vi.stubEnv("BREVO_API_KEY", "test-key");
  vi.stubEnv("EMAIL_FROM", "account@clipmax.froshcodeorbit.site");
  const logs = vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 201 })));
  try {
    await sendVerificationCodeEmail("test@example.test", "730492");
    expect(logs).toHaveBeenCalledWith("BREVO_DELIVERY_ACCEPTED", { status: 201 });
    expect(JSON.stringify(logs.mock.calls)).not.toContain("730492");
    expect(JSON.stringify(logs.mock.calls)).not.toContain("test@example.test");
  } finally {
    logs.mockRestore();
  }
});
