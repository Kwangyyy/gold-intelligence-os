// Email notification helper — uses Gmail SMTP via nodemailer.
// Requires .env.local:
//   SMTP_GMAIL_USER=your@gmail.com
//   SMTP_GMAIL_PASS=xxxx xxxx xxxx xxxx   (Gmail App Password)
//   ADMIN_NOTIFY_EMAIL=your@gmail.com      (who receives the alert)
//
// If env vars are missing, notification is silently skipped (queue still works).

import nodemailer from "nodemailer";

function getTransport() {
  const user = process.env.SMTP_GMAIL_USER;
  const pass = process.env.SMTP_GMAIL_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function notifyNewUserRegistered(newUser: {
  email: string;
  name:  string;
}): Promise<void> {
  const transport = getTransport();
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!transport || !to) return;

  const adminUrl = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/admin`
    : "https://gold-intelligence-os.vercel.app/admin";

  try {
    await transport.sendMail({
      from: `"Gold Intelligence OS" <${process.env.SMTP_GMAIL_USER}>`,
      to,
      subject: `🆕 New user request: ${newUser.name} (${newUser.email})`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;background:#0a0f1e;color:#e2e8f0;border-radius:12px;">
          <h2 style="color:#f5c451;margin-bottom:8px;">⚡ New User Pending Approval</h2>
          <p style="color:#94a3b8;margin:0 0 20px;">A new user has logged in and is waiting for your approval.</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <tr><td style="padding:8px 0;color:#64748b;font-size:12px;">Name</td><td style="padding:8px 0;font-weight:bold;">${newUser.name}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-size:12px;">Email</td><td style="padding:8px 0;font-weight:bold;">${newUser.email}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-size:12px;">Time</td><td style="padding:8px 0;">${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</td></tr>
          </table>
          <a href="${adminUrl}" style="display:inline-block;background:#f5c451;color:#0a0f1e;padding:12px 24px;border-radius:8px;font-weight:bold;text-decoration:none;font-size:14px;">
            → Go to Admin Panel
          </a>
          <p style="color:#334155;font-size:11px;margin-top:24px;">Gold Intelligence OS — Admin Notification</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[notify] email failed:", err);
  }
}
