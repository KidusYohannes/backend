import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { htmlToText } from 'html-to-text';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendEmail(
  receiver: string,
  subject: string,
  message: string
): Promise<void> {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: receiver,
    subject,
    text: message,
    // html: `<p>${message}</p>`, // optionally send as HTML
  });
}

export async function sendEmailHtml(
  receiver: string,
  subject: string,
  message: string
): Promise<void> {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: receiver,
    subject,
    html: message,
    text: htmlToText(message), // convert HTML to plain text
    // html: `<p>${message}</p>`, // optionally send as HTML
  });
}
