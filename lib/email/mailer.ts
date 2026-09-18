import "server-only";
import nodemailer from "nodemailer";

/**
 * Utgående mejl via egen SMTP (t.ex. Hostinger). Konfigureras helt med miljövariabler;
 * saknas de skickas ingenting, och anroparen får veta det (så att cron-jobbet kan rapportera
 * "hoppade över" i stället för att krascha).
 */
export type MailMessage = { to: string; subject: string; text: string; html: string };

export type MailerConfig = { host: string; port: number; secure: boolean; user: string; pass: string; from: string };

export function readMailerConfig(env: NodeJS.ProcessEnv = process.env): MailerConfig | null {
  const host = env.SMTP_HOST;
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  const from = env.EMAIL_FROM;
  if (!host || !user || !pass || !from) return null;
  const port = Number.parseInt(env.SMTP_PORT ?? "465", 10);
  return { host, port: Number.isFinite(port) ? port : 465, secure: (env.SMTP_SECURE ?? (port === 465 ? "true" : "false")) === "true", user, pass, from };
}

export type Mailer = { send(message: MailMessage): Promise<void> };

export function createMailer(config: MailerConfig): Mailer {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  return {
    async send(message) {
      await transport.sendMail({ from: config.from, to: message.to, subject: message.subject, text: message.text, html: message.html });
    },
  };
}
