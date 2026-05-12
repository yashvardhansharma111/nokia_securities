import nodemailer from "nodemailer";

type SendClientCredentialsEmailParams = {
  to: string;
  fullName?: string | null;
  clientId: string;
  password: string;
};

let transporter: nodemailer.Transporter | null = null;
let transporterUser: string | undefined;

function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Rebuild if credentials changed (e.g. after .env edit + server restart)
  if (transporter && transporterUser === user) {
    return transporter;
  }

  if (!user || !pass) {
    throw new Error("SMTP credentials are not configured");
  }

  const host = process.env.SMTP_HOST || "smtp.titan.email";
  const port = Number(process.env.SMTP_PORT || "465");

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: { user, pass },
  });
  transporterUser = user;

  return transporter;
}

export async function sendClientCredentialsEmail({
  to,
  fullName,
  clientId,
  password,
}: SendClientCredentialsEmailParams) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    throw new Error("SMTP sender is not configured");
  }

  const name = fullName?.trim() || "Client";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;color:#0f172a">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px">
        <h2 style="margin:0 0 12px;font-size:24px;color:#0369a1">Nokia Securities Login Credentials</h2>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6">Hello ${name},</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6">
          Your trading account has been activated by the admin team. Use the credentials below to sign in to the app.
        </p>
        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:16px;margin:16px 0">
          <p style="margin:0 0 8px;font-size:14px"><strong>Client ID:</strong> ${clientId}</p>
          <p style="margin:0;font-size:14px"><strong>Password:</strong> ${password}</p>
        </div>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.6">
          Please keep these credentials secure. After signing in, you can review your profile, orders, positions, funds, and ledger inside the app.
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#475569">
          If you did not request this account, please contact support immediately.
        </p>
      </div>
    </div>
  `;

  const text = [
    `Hello ${name},`,
    "",
    "Your Nokia Securities trading account has been activated.",
    `Client ID: ${clientId}`,
    `Password: ${password}`,
    "",
    "Please keep these credentials secure.",
  ].join("\n");

  await getTransporter().sendMail({
    from,
    to,
    subject: "Your Nokia Securities login credentials",
    html,
    text,
  });
}
