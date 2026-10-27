
'use strict';

const nodemailer = require('nodemailer');

const FROM = process.env.BIRT_SMTP_USER;
const ADMIN_EMAIL = process.env.BIRT_ADMIN_EMAIL ||
  'research@birtlab.com';

function createTransport() {
  const host = process.env.BIRT_SMTP_HOST;
  const port = Number(process.env.BIRT_SMTP_PORT || 465);
  const user = process.env.BIRT_SMTP_USER;
  const pass = process.env.BIRT_SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error('BIRT SMTP configuration is incomplete');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendExpertEmails(expert) {
  const transporter = createTransport();

  const name = expert.name;
  const reference = expert.reference;
  const roles = Array.isArray(expert.roles)
    ? expert.roles.join(', ')
    : String(expert.roles || '');

  const isMember = expert.membershipStatus === 'Active';
  const membershipLine = isMember
    ? 'Your free BIRT Lab membership is now active.'
    : 'You have not joined BIRT Lab membership.';

  const applicantEmail = {
    from: `"BIRT Lab Research" <${FROM}>`,
    to: expert.email,
    subject: 'TERMIS-AP 2028 | Expression of Interest Received',
    text: [
      `Dear ${name},`,
      '',
      'Thank you for expressing your interest in contributing to TERMIS Asia-Pacific 2028.',
      '',
      'We have successfully received your expression of interest.',
      '',
      `Registration Reference: ${reference}`,
      `Participation Interests: ${roles}`,
      membershipLine,
      '',
      'Your information has been recorded for consideration in relation to relevant scientific and professional participation opportunities.',
      '',
      'Please note that this acknowledgement does not constitute confirmation of appointment, invitation or participation.',
      '',
      'We appreciate your interest in supporting scientific exchange and collaboration in tissue engineering and regenerative medicine.',
      '',
      'Kind regards,',
      'BIRT Lab Research Secretariat',
      'Engineering Life Through Technology',
      'research@birtlab.com',
      'https://birtlab.com'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:650px;margin:auto;color:#0e1d1f;line-height:1.7">
        <div style="border-bottom:3px solid #0b7771;padding:20px 0">
          <h1 style="margin:0;font-size:30px">
            BIRT<span style="color:#0b7771">LAB</span>
          </h1>
          <div style="font-size:12px;color:#0b7771">
            ENGINEERING LIFE THROUGH TECHNOLOGY
          </div>
        </div>

        <h2 style="margin-top:30px">Expression of Interest Received</h2>

        <p>Dear ${escapeHtml(name)},</p>

        <p>Thank you for expressing your interest in contributing to
        <strong>TERMIS Asia-Pacific 2028</strong>.</p>

        <p>We have successfully received your expression of interest.</p>

        <div style="background:#f2f6f4;padding:20px;border-left:4px solid #ff8200;margin:25px 0">
          <div style="font-size:12px;color:#667779">REGISTRATION REFERENCE</div>
          <div style="font-size:20px;font-weight:bold;overflow-wrap:anywhere">
            ${escapeHtml(reference)}
          </div>
          <p style="margin-bottom:0">
            <strong>Participation Interests:</strong><br>
            ${escapeHtml(roles)}
          </p>
        </div>

        <p><strong>BIRT Lab membership:</strong> ${escapeHtml(membershipLine)}</p>

        <p>Your information has been recorded for consideration
        in relation to relevant scientific and professional
        participation opportunities.</p>

        <p><strong>Please note:</strong> This acknowledgement does
        not constitute confirmation of appointment, invitation
        or participation.</p>

        <p>We appreciate your interest in supporting scientific
        exchange and collaboration in tissue engineering and
        regenerative medicine.</p>

        <p>Kind regards,<br>
        <strong>BIRT Lab Research Secretariat</strong><br>
        <span style="color:#0b7771">Engineering Life Through Technology</span></p>

        <p style="font-size:13px">
          <a href="https://birtlab.com">birtlab.com</a>
        </p>
      </div>
    `
  };

  const adminEmail = {
    from: `"BIRT Lab Registration" <${FROM}>`,
    to: ADMIN_EMAIL,
    replyTo: expert.email,
    subject: `New TERMIS-AP 2028 Registration | ${reference}`,
    text: [
      'New TERMIS-AP 2028 expression of interest received.',
      '',
      `Reference: ${reference}`,
      `Name: ${name}`,
      `Email: ${expert.email}`,
      `Organisation: ${expert.organisation}`,
      `Designation: ${expert.designation}`,
      `Country: ${expert.country}`,
      `Participation Interests: ${roles}`,
      membershipLine,
      `Expertise: ${expert.expertise}`,
      '',
      'Review this registration in the BIRT Lab Admin Dashboard:',
      'https://birtlab.com/experts-admin.html'
    ].join('\n')
  };

  // Independent sends: one failure does not prevent the other.
  const results = await Promise.allSettled([
    transporter.sendMail(applicantEmail),
    transporter.sendMail(adminEmail)
  ]);

  const labels = ['applicant', 'administrator'];

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(
        `BIRT ${labels[index]} email failed:`,
        result.reason
      );
    }
  });

  return {
    applicantSent: results[0].status === 'fulfilled',
    adminSent: results[1].status === 'fulfilled'
  };
}

module.exports = { sendExpertEmails };
