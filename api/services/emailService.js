// api/services/emailService.js
// Wrapper sobre Resend. Si no hay RESEND_API_KEY (dev sin proveedor) imprime el link
// en consola para poder seguir probando el flujo.
import { Resend } from 'resend';

let cached = null;

function getResend() {
  if (cached !== null) return cached;
  const key = process.env.RESEND_API_KEY;
  cached = key ? new Resend(key) : false;
  return cached;
}

export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

export async function sendMagicLinkEmail({ to, link, expiresMinutes }) {
  const from = process.env.MAGIC_LINK_FROM_EMAIL || 'onboarding@resend.dev';
  const resend = getResend();

  if (!resend) {
    console.warn('\x1b[33m[emailService] RESEND_API_KEY no configurada — link enviado a consola en lugar de email\x1b[0m');
    console.log(`\x1b[36m[magic-link] ${to} → ${link}\x1b[0m`);
    return { devMode: true };
  }

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: 'Tu link de acceso a AS Tools',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1f2937;">
        <h1 style="margin: 0 0 16px; font-size: 22px;">Tu link de acceso</h1>
        <p style="margin: 0 0 24px; line-height: 1.5;">Haz clic en el botón para entrar a AS Tools. Este link caduca en ${expiresMinutes} minutos y solo se puede usar una vez.</p>
        <p style="margin: 0 0 24px;">
          <a href="${link}" style="display: inline-block; background: #7c3aed; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Iniciar sesión</a>
        </p>
        <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">¿El botón no funciona? Copia y pega este link:</p>
        <p style="margin: 0; font-size: 12px; color: #6b7280; word-break: break-all;">${link}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 16px;" />
        <p style="margin: 0; font-size: 12px; color: #9ca3af;">Si no pediste este link, puedes ignorarlo.</p>
      </div>
    `
  });

  if (error) {
    throw new Error(`Resend: ${error.message || JSON.stringify(error)}`);
  }
  return { id: data?.id };
}
