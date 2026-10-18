import { required } from "./config";

type Mail = { to: string; subject: string; text: string; html?: string };

async function sendBrevoMail({ to, subject, text, html }: Mail) {
  const from = required("EMAIL_FROM").trim();
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(from);
  const sender = match
    ? { name: match[1].trim() || "Clipmax", email: match[2].trim() }
    : { name: "Clipmax", email: from };

  let response: Response;
  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
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
        textContent: text,
        ...(html ? { htmlContent: html } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // Never log email addresses, API credentials, verification codes or links.
    console.error("BREVO_DELIVERY_NETWORK_FAILURE");
    throw new Error("EMAIL_DELIVERY_FAILED");
  }
  if (!response.ok) {
    console.error("BREVO_DELIVERY_REJECTED", { status: response.status });
    throw new Error("EMAIL_DELIVERY_FAILED");
  }
  // No code, token or recipient is logged. This confirms provider acceptance
  // only; check Brevo Transactional Logs for delivered/bounced status.
  console.info("BREVO_DELIVERY_ACCEPTED", { status: response.status });
  // Brevo HTTP 201 means accepted, not that the email reached an inbox.
}

export async function sendAuthEmail(to: string, subject: string, url: string) {
  await sendBrevoMail({
    to,
    subject,
    text: `${subject}\n\n${url}\n\nIf you did not request this, ignore this email.`,
  });
}

export async function sendVerificationCodeEmail(to: string, code: string) {
  if (!/^\d{6}$/.test(code)) throw new Error("INVALID_VERIFICATION_CODE");
  const subject = "Your Clipmax verification code";
  const text = `Welcome to Clipmax!

Your verification code: ${code}

Enter this code on the verification screen. It expires in 5 minutes.
Do not share the code. If you didn't request it, ignore this email.`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 12px;background:#f5f3f7;font-family:Arial,Helvetica,sans-serif;color:#24152e">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:540px;margin:auto">
<tr><td style="padding:0 4px 20px;font-size:25px;font-weight:800;color:#251139">clipmax<span style="color:#c60835">.</span></td></tr>
<tr><td style="border-radius:20px;overflow:hidden;background:#ffffff;border:1px solid #eee7ef">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%">
<tr><td style="padding:30px 32px;background:#251139;color:#ffffff"><div style="font-size:11px;letter-spacing:2px;color:#e9aec5;font-weight:700">ACCOUNT VERIFICATION</div><h1 style="font-size:26px;line-height:1.2;margin:12px 0 0;color:#ffffff">One quick step to start creating.</h1></td></tr>
<tr><td style="padding:32px"><p style="font-size:15px;line-height:1.7;margin:0 0 18px;color:#44374e">Welcome to Clipmax! Enter this code on the verification screen to confirm your email address.</p>
<div style="border:1px solid #eadde6;background:#faf4f7;border-radius:14px;text-align:center;padding:22px 8px;margin-bottom:18px">
<div style="font-size:11px;letter-spacing:1.5px;color:#8d7185;font-weight:700;margin-bottom:10px">YOUR SIX-DIGIT CODE</div>
<div style="font-size:36px;line-height:1.3;font-weight:800;letter-spacing:9px;color:#a90b38">${code}</div>
</div><p style="font-size:13px;line-height:1.6;color:#796e7d;margin:0">This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p></td></tr>
<tr><td style="border-top:1px solid #f0e9ef;padding:20px 32px 26px;color:#8d818e;font-size:12px">Didn't request this code? You can safely ignore this email.</td></tr>
</table></td></tr><tr><td style="padding:20px 10px;text-align:center;color:#9a909d;font-size:11px">Clipmax · Make every moment count</td></tr>
</table></body></html>`;
  await sendBrevoMail({ to, subject, text, html });
}
