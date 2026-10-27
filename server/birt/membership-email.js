
'use strict';

const nodemailer = require('nodemailer');

const FROM = 'research@birtlab.com';

function createTransport() {
  const host = process.env.BIRT_SMTP_HOST;
  const port = Number(process.env.BIRT_SMTP_PORT || 465);
  const user = process.env.BIRT_SMTP_USER;
  const pass = process.env.BIRT_SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error('BIRT SMTP configuration is incomplete.');
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

async function sendMembershipEmails(member) {
  const transporter = createTransport();

  const name = member.name;
  const memberId = member.memberId;
  const category = member.membershipCategory;

  const applicantEmail = {
    from: `"BIRT Lab Research" <${FROM}>`,
    to: member.email,
    subject: 'Welcome to BIRT Lab | Your Membership Confirmation',

    text: [
      `Dear ${name},`,
      '',
      'Welcome to the BIRT Lab Research Community!',
      '',
      'We are pleased to confirm that your free BIRT Lab membership is now active.',
      '',
      `Membership ID: ${memberId}`,
      `Membership Category: ${category}`,
      'Membership Status: Active',
      'Membership Fee: Free',
      '',
      'As part of our research community, you can stay connected with opportunities for scientific knowledge exchange, interdisciplinary research and professional collaboration.',
      '',
      'We look forward to building meaningful connections across bioengineering, biomaterials, tissue engineering and regenerative technologies.',
      '',
      'For membership enquiries or updates to your details, please contact research@birtlab.com.',
      '',
      'Kind regards,',
      'BIRT Lab Research Secretariat',
      'Engineering Life Through Technology',
      'https://birtlab.com'
    ].join('\n'),

    html: `
      <div style="font-family:Arial,sans-serif;max-width:650px;margin:auto;color:#0e1d1f;line-height:1.7">
        <div style="border-bottom:3px solid #0b7771;padding:22px 0">
          <h1 style="font-size:34px;margin:0;font-weight:900">
            BIRT<span style="color:#0b7771">LAB</span>
          </h1>
          <div style="font-size:11px;letter-spacing:1.5px;color:#0b7771">
            ENGINEERING LIFE THROUGH TECHNOLOGY
          </div>
        </div>

        <div style="padding:30px 0">
          <p style="font-size:12px;color:#0b7771;font-weight:bold;letter-spacing:1.5px">
            MEMBERSHIP CONFIRMATION
          </p>

          <h2 style="font-size:30px;line-height:1.2;margin:10px 0 24px">
            Welcome to the BIRT Lab Research Community.
          </h2>

          <p>Dear ${escapeHtml(name)},</p>

          <p>We are pleased to confirm that your
          <strong>free BIRT Lab membership is now active.</strong></p>

          <div style="background:#f2f6f4;padding:24px;border-left:4px solid #0b7771;margin:25px 0">
            <div style="font-size:11px;color:#667779;font-weight:bold">
              YOUR MEMBERSHIP ID
            </div>

            <div style="font-size:22px;font-weight:900;color:#0e1d1f;overflow-wrap:anywhere;margin:8px 0 18px">
              ${escapeHtml(memberId)}
            </div>

            <div><strong>Category:</strong> ${escapeHtml(category)}</div>
            <div><strong>Status:</strong> Active</div>
            <div><strong>Membership Fee:</strong> Free</div>
          </div>

          <p>As part of our research community, you can connect
          with scientific ideas, knowledge exchange and opportunities
          for interdisciplinary collaboration.</p>

          <p>We look forward to building meaningful connections
          across bioengineering, biomaterials, tissue engineering
          and regenerative technologies.</p>

          <p>For membership enquiries or updates to your details,
          contact <a href="mailto:research@birtlab.com">research@birtlab.com</a>.</p>

          <p style="margin-top:32px">
            Kind regards,<br>
            <strong>BIRT Lab Research Secretariat</strong><br>
            <span style="color:#0b7771">Engineering Life Through Technology</span>
          </p>
        </div>

        <div style="border-top:1px solid #cfdad7;padding:20px 0;font-size:12px;color:#667779">
          BIRT Lab · <a href="https://birtlab.com">birtlab.com</a>
        </div>
      </div>
    `
  };

  const adminEmail = {
    from: `"BIRT Lab Membership" <${FROM}>`,
    to: FROM,
    replyTo: member.email,
    subject: `New BIRT Lab Member | ${memberId}`,

    text: [
      'A new BIRT Lab membership has been activated.',
      '',
      `Membership ID: ${memberId}`,
      `Name: ${name}`,
      `Email: ${member.email}`,
      `Category: ${category}`,
      `Organisation: ${member.organisation || '-'}`,
      `Designation: ${member.designation || '-'}`,
      `Country: ${member.country}`,
      `Expertise: ${member.expertise || '-'}`,
      'Membership Status: Active',
      'Membership Fee: Free',
      '',
      'View membership records:',
      'https://birtlab.com/experts-admin.html'
    ].join('\n')
  };

  const results = await Promise.allSettled([
    transporter.sendMail(applicantEmail),
    transporter.sendMail(adminEmail)
  ]);

  const labels = ['member', 'administrator'];

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(
        `BIRT membership ${labels[index]} email failed:`,
        result.reason
      );
    }
  });

  return {
    memberSent: results[0].status === 'fulfilled',
    adminSent: results[1].status === 'fulfilled'
  };
}

module.exports = { sendMembershipEmails };
