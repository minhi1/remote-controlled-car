const { text } = require('express');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Define a transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MY_MAIL,
    pass: process.env.APP_PW 
  }
});

async function sendMail({ to, subject, text, html }) {
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to,
    subject,
    text,
    html
  };

  /**
   * Usage:   
    mailer.sendMail({
      to: process.env.MY_MAIL, 
      subject: 'Test node mailer',
      text: 'Hiluu from mi1',
      html: (Optional)
  });

   */

  return transporter.sendMail(mailOptions);
}

module.exports = {
  sendMail
};