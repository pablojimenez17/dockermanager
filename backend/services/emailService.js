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

export default {
  sendWelcomeEmail
};
