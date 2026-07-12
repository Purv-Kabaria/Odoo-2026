import nodemailer from "nodemailer";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Singleton SMTP transport. Falls back to a console-only "preview" mode when
 * SMTP env vars are absent — emails are logged instead of sent, keeping local
 * dev friction-free while still exercising the code path.
 */
function createTransport() {
  if (!env.SMTP_HOST) {
    logger.warn("mail.transport.preview", {
      message: "SMTP_HOST not set — emails will be logged to console only.",
    });
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER ?? "",
      pass: env.SMTP_PASS ?? "",
    },
  });
}

let _transport: ReturnType<typeof createTransport> | undefined;

function getTransport() {
  if (_transport === undefined) {
    _transport = createTransport();
  }
  return _transport;
}

type SendMailOptions = {
  to: string;
  subject: string;
  html: string;
};

export async function sendMail({ to, subject, html }: SendMailOptions): Promise<boolean> {
  const transport = getTransport();

  if (!transport) {
    // Preview mode — log the email to the console so devs can still test.
    logger.info("mail.preview", { to, subject });
    console.log("\n📧 EMAIL PREVIEW (SMTP not configured):");
    console.log(`   To:      ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body:    (HTML content — check logs)\n`);
    return true;
  }

  try {
    await transport.sendMail({
      from: env.SMTP_FROM ?? `"AssetFlow" <noreply@assetflow.app>`,
      to,
      subject,
      html,
    });
    logger.info("mail.sent", { to, subject });
    return true;
  } catch (error) {
    logger.error("mail.send.failed", error, { to, subject });
    return false;
  }
}

/**
 * Build and send the invite email with the password-setup link.
 */
export async function sendInviteEmail(options: {
  to: string;
  name: string;
  setupUrl: string;
  invitedByName: string;
}): Promise<boolean> {
  const { to, name, setupUrl, invitedByName } = options;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #1a1a2e;">
      <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 600;">Welcome to AssetFlow</h2>
      <p style="margin: 0 0 24px; color: #555; font-size: 15px; line-height: 1.6;">
        Hi <strong>${name}</strong>, you have been invited by <strong>${invitedByName}</strong> to join the team.
      </p>

      <p style="margin: 0 0 8px; color: #555; font-size: 14px;">
        Click the button below to set your password and activate your account:
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${setupUrl}"
           style="display: inline-block; padding: 12px 32px; background: #4f46e5; color: #fff;
                  text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">
          Set Your Password
        </a>
      </div>

      <p style="margin: 0 0 4px; color: #888; font-size: 13px;">
        Or copy and paste this URL into your browser:
      </p>
      <p style="margin: 0 0 24px; color: #4f46e5; font-size: 13px; word-break: break-all;">
        ${setupUrl}
      </p>

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
      <p style="margin: 0; color: #999; font-size: 12px;">
        This link expires in 48 hours. If you didn't expect this invite, you can safely ignore this email.
      </p>
    </div>
  `;

  return sendMail({
    to,
    subject: `${invitedByName} invited you to AssetFlow — set your password`,
    html,
  });
}
