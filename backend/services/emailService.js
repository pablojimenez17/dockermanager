import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

  try {
    await sgMail.send(msg);
    console.log(`Welcome email sent to ${to}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    if (error.response) {
      console.error(error.response.body);
    }
  }
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

  try {
    await sgMail.send(msg);
    console.log(`Verification code sent to ${to}`);
  } catch (error) {
    console.error('Error sending verification code:', error);
  }
};

export default {
  sendWelcomeEmail,
  sendVerificationCode
};
