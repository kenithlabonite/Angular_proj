// _helpers/send-email.js
const nodemailer = require('nodemailer');
const config = require('config.json');

module.exports = sendEmail;

async function sendEmail({ to, subject, html, from = config.emailFrom }) {
  let transporter;
  let usedTestAccount = false;

  // Try to use configured SMTP options first (if present)
  if (config && config.smtpOptions && config.smtpOptions.host) {
    try {
      transporter = nodemailer.createTransport(config.smtpOptions);
      // verify() will throw if auth or connection fails
      await transporter.verify();
      console.log('SMTP transporter verified using config.smtpOptions.');
    } catch (err) {
      console.error('Configured SMTP verify failed:', err && err.message ? err.message : err);
      transporter = null;
    }
  }

  // If we don't have a working transporter from config, create a test account
  if (!transporter) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      usedTestAccount = true;
      console.log('Using nodemailer test account:', testAccount.user);
    } catch (err) {
      console.error('Failed to create nodemailer test account:', err && err.message ? err.message : err);
      // If we can't create a test account either, fail gracefully by returning null
      return null;
    }
  }

  // Try to send the message
  try {
    const info = await transporter.sendMail({ from, to, subject, html });
    console.log('Email send attempted. messageId:', info && info.messageId ? info.messageId : 'none');

    if (usedTestAccount && nodemailer.getTestMessageUrl) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('Preview URL (open in browser):', previewUrl);
    }

    return info;
  } catch (err) {
    console.error('Failed to send email:', err && err.message ? err.message : err);
    // Don't throw — return null so registration can continue while you debug.
    return null;
  }
}
