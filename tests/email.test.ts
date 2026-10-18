import { afterEach, expect, it, vi } from "vitest";
import { sendAuthEmail } from "../src/lib/email";
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
