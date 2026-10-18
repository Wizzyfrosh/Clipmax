import { required } from "./config";

export async function sendAuthEmail(to: string, subject: string, url: string) {
  const from = required("EMAIL_FROM").trim();
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(from);
  const sender = match
    ? { name: match[1].trim() || "Clipmax", email: match[2].trim() }
    : { name: "Clipmax", email: from };
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": required("BREVO_API_KEY"),
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      textContent: `${subject}\n\n${url}\n\nIf you did not request this, ignore this email.`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  // Never log provider bodies, recipients or verification/reset URLs.
  if (!response.ok) throw new Error("EMAIL_DELIVERY_FAILED");
}
