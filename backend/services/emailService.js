import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.SENDGRID_API_KEY) {
  throw new Error('Missing SENDGRID_API_KEY environment variable');
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendMailOrThrow = async (msg, contextLabel) => {
  try {
    await sgMail.send(msg);
  } catch (error) {
    const sendgridMessage =
      error?.response?.body?.errors?.map((e) => e.message).join(' | ') ||
      error.message ||
      'Unknown SendGrid error';
    console.error(`Error sending ${contextLabel}:`, sendgridMessage);
    throw new Error(`SendGrid ${contextLabel} failed: ${sendgridMessage}`);
  }
};

export const sendWelcomeEmail = async (to, name) => {
  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@orbitcloud.app',
    subject: '¡Bienvenido a OrbitCloud!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2b6cb0;">¡Hola ${name}!</h2>
        <p>Gracias por registrarte en OrbitCloud. Estamos encantados de tenerte a bordo.</p>
        <p>A partir de ahora podrás gestionar todos tus contenedores y despliegues de forma sencilla.</p>
        <br/>
        <p>Un saludo,</p>
        <p><strong>El equipo de OrbitCloud</strong></p>
      </div>
    `,
  };

  await sendMailOrThrow(msg, 'welcome email');
  console.log(`Welcome email sent to ${to}`);
};

export const sendVerificationCode = async (to, code) => {
  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@orbitcloud.app',
    subject: 'Tu código de verificación - OrbitCloud',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2b6cb0;">Código de Verificación</h2>
        <p>Has solicitado iniciar sesión o registrarte. Aquí tienes tu código temporal:</p>
        <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="font-size: 36px; letter-spacing: 5px; margin: 0; color: #2d3748;">${code}</h1>
        </div>
        <p style="font-size: 14px; color: #718096;">Este código caducará en 10 minutos.</p>
        <p>Si no has solicitado esto, puedes ignorar este mensaje.</p>
      </div>
    `,
  };

  await sendMailOrThrow(msg, 'verification code');
  console.log(`Verification code sent to ${to}`);
};

export const sendPasswordResetEmail = async (to, code) => {
  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@orbitcloud.app',
    subject: 'Restablecer Contraseña - OrbitCloud',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2b6cb0;">Restablecer Contraseña</h2>
        <p>Has solicitado restablecer tu contraseña. Aquí tienes tu código temporal:</p>
        <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="font-size: 36px; letter-spacing: 5px; margin: 0; color: #2d3748;">${code}</h1>
        </div>
        <p style="font-size: 14px; color: #718096;">Este código caducará en 10 minutos.</p>
        <p>Si no has solicitado esto, puedes ignorar este mensaje o contactar con soporte.</p>
      </div>
    `,
  };

  await sendMailOrThrow(msg, 'password reset code');
  console.log(`Password reset code sent to ${to}`);
};

export default {
  sendWelcomeEmail,
  sendVerificationCode,
  sendPasswordResetEmail
};
