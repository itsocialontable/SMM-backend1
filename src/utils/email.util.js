// FILE: src/utils/email.util.js
//
// UPDATED: Nodemailer + Gmail SMTP se Resend (HTTP API) pe switch kiya.
// Wajah: Render (aur kai doosre free-tier hosts) outbound SMTP ports
// (587/465) block kar dete hain, isliye Gmail se email bhejna live
// deploy pe fail ho jaata — Resend normal HTTPS ke through kaam karta
// hai isliye ye hamesha kaam karega, chahe local ho ya Render pe live.
//
// Setup: Resend.com pe free account banao, API key generate karo, aur
// .env me RESEND_API_KEY set karo. RESEND_FROM_EMAIL bhi set karo
// (Resend ke domain-verification wale email se, ya test ke liye
// "onboarding@resend.dev" use kar sakte ho jab tak apna domain verify
// na ho jaye).
const axios = require("axios");

const RESEND_API_KEY   = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Growth Craft 360 <onboarding@resend.dev>";

const base = (body) => `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body{margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif}
  .wrap{max-width:580px;margin:30px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.09)}
  .top{background:#1a1a2e;padding:22px 30px}
  .top h1{margin:0;color:#fff;font-size:19px;font-weight:600}
  .top h1 span{color:#7c83fd}
  .mid{padding:30px}
  .mid h2{margin:0 0 10px;font-size:17px;color:#1a1a2e}
  .mid p{margin:0 0 14px;font-size:14px;line-height:1.7;color:#555}
  .badge{display:inline-block;padding:5px 13px;border-radius:20px;font-size:11px;font-weight:700;margin-bottom:14px}
  .b-success{background:#e6f4ea;color:#1e7e34}
  .b-warning{background:#fff3cd;color:#856404}
  .b-info{background:#e8f0fe;color:#1a73e8}
  .box{background:#f8f9fa;border-left:4px solid #7c83fd;border-radius:4px;padding:13px 17px;margin:14px 0;font-size:13px;color:#444;line-height:1.7}
  .box b{color:#222}
  .pwd{background:#1a1a2e;color:#7c83fd;font-family:monospace;font-size:15px;font-weight:700;padding:10px 18px;border-radius:6px;display:inline-block;letter-spacing:1px;margin:8px 0}
  .foot{background:#f8f8f8;padding:18px 30px;text-align:center;font-size:11px;color:#aaa;border-top:1px solid #eee}
</style></head>
<body><div class="wrap">
  // <div class="top"><h1>SMM <span>Platform</span></h1></div>
<div class="top"><h1>Growth Craft <span>360</span></h1></div> 
 <div class="mid">${body}</div>
<div class="foot">This is an automated email. Please do not reply.<br>© ${new Date().getFullYear()} Social On Table</div></div></body></html>`;
const templates = {
 account_created: ({ name, role, email, password, agencyName }) => ({
  subject: `Welcome to Social On Table — Your Account is Ready`,
  html: base(`
    <span class="badge b-success">Account Created</span>

    <h2>Welcome, ${name}! 👋</h2>

    <p>Your account has been successfully created on Social On Table.</p>

    <div class="box">
      <b>Name:</b> ${name}<br>
      <b>Role:</b> ${role}<br>
      ${agencyName ? `<b>Agency:</b> ${agencyName}<br>` : ""}
      <b>Email:</b> ${email}<br>
      <b>Password:</b><br>
      <div class="pwd">${password}</div>
    </div>

    <p>You can now log in using the credentials above.</p>
  `)
}),
project_assigned: ({ name, projectTitle, deadline, priority }) => ({
  subject: `New Project Assigned — ${projectTitle}`,
  html: base(`
    <span class="badge b-info">New Assignment</span>

    <h2>You Have Been Assigned a New Project</h2>

    <p>Hello <b>${name}</b>,</p>

    <div class="box">
      <b>Project:</b> ${projectTitle}<br>
      <b>Deadline:</b> ${deadline}<br>
      <b>Priority:</b> ${priority}
    </div>

    <p>Please log in to your dashboard to review the project details and begin work.</p>
  `)
}),
design_submitted: ({ name, projectTitle, isClient }) => ({
  subject: `Design Submitted For Review — ${projectTitle}`,
  html: base(`
    <span class="badge b-info">${isClient ? "Action Required" : "Update"}</span>

    <h2>${isClient ? "Design Ready For Review" : "Design Submitted Successfully"}</h2>

    <p>Hello <b>${name}</b>,</p>

    ${
      isClient
        ? `<p>The design for <b>${projectTitle}</b> is ready for review. Please log in to approve the design or request revisions.</p>`
        : `<p>The design for <b>${projectTitle}</b> has been submitted successfully and is awaiting client review.</p>`
    }

    <div class="box">
      <b>Project:</b> ${projectTitle}<br>
      <b>Status:</b> Under Review
    </div>
  `)
}),
 client_approved: ({ name, projectTitle, isGD }) => ({
  subject: `Design Approved — ${projectTitle}`,
  html: base(`
    <span class="badge b-success">Approved ✅</span>

    <h2>Design Approved Successfully 🎉</h2>

    <p>Hello <b>${name}</b>,</p>

    <p>The design for <b>${projectTitle}</b> has been approved.</p>

    <div class="box">
      <b>Project:</b> ${projectTitle}<br>
      <b>Status:</b> Completed
    </div>
  `)
}),
client_rejected: ({ name, projectTitle, feedback, isGD }) => ({
  subject: `Revision Required — ${projectTitle}`,
  html: base(`
    <span class="badge b-warning">Revision Required</span>

    <h2>Revision Requested</h2>

    <p>Hello <b>${name}</b>,</p>

    <div class="box">
      <b>Project:</b> ${projectTitle}<br>
      <b>Feedback:</b> ${feedback || "No feedback provided"}<br>
      <b>Status:</b> Revision Requested
    </div>
  `)
}),
revision_requested: ({
  name,
  projectTitle,
  revisionMessage,
  revisionCount,
  revisionLimit
}) => ({
  subject: `Revision #${revisionCount} — ${projectTitle}`,
  html: base(`
    <span class="badge b-warning">Revision #${revisionCount}</span>

    <h2>Revision Request Received</h2>

    <p>Hello <b>${name}</b>,</p>

    <p>A revision request has been submitted for the following project.</p>

    <div class="box">
      <b>Project:</b> ${projectTitle}<br>
      <b>Revision:</b> ${revisionCount} of ${revisionLimit}<br>
      <b>Message:</b> ${revisionMessage}
    </div>
  `)
}),
 project_completed: ({ name, projectTitle }) => ({
  subject: `Project Completed — ${projectTitle}`,
  html: base(`
    <span class="badge b-success">Completed 🏆</span>

    <h2>Project Completed Successfully</h2>

    <p>Hello <b>${name}</b>,</p>

    <p>The project <b>${projectTitle}</b> has been successfully completed.</p>
  `)
}),
post_published: ({ name, platform, content }) => ({
  subject: `Post Published — ${platform}`,
  html: base(`
    <span class="badge b-success">Published</span>

    <h2>Your Post Has Been Published 🚀</h2>

    <p>Hello <b>${name}</b>,</p>

    <p>Your content has been successfully published on <b>${platform}</b>.</p>

    <div class="box">
      <b>Content:</b> ${(content || "").substring(0, 120)}
    </div>
  `)
}),
agency_created: ({ name, agencyName, email, password }) => ({
  subject: `Welcome to Social On Table — Agency Account Created`,
  html: base(`
    <span class="badge b-success">Agency Created</span>

    <h2>Welcome to Social On Table! 🎉</h2>

    <p>Your agency account has been successfully created by the Super Administrator.</p>

    <div class="box">
      <b>Agency Name:</b> ${agencyName || name}<br>
      <b>Admin Email:</b> ${email}<br>
      <b>Password:</b><br>
      <div class="pwd">${password}</div>
    </div>

    <p>You can now log in and start managing your team, clients, projects, and social media operations.</p>
  `)
}),
 default: ({ name, title, message }) => ({
  subject: title,
  html: base(`
    <span class="badge b-info">Notification</span>

    <h2>${title}</h2>

    <p>Hello <b>${name}</b>,</p>

    <p>${message}</p>
  `)
})
};

const sendEmail = async ({ to, name, event, templateData = {} }) => {
  try {
    if (!RESEND_API_KEY) {
      console.log(`EMAIL not configured (RESEND_API_KEY missing) — skipping: ${event}`);
      return null;
    }
    const fn = templates[event] || templates.default;
    const { subject, html } = fn({ name, ...templateData });

    await axios.post(
      "https://api.resend.com/emails",
      { from: RESEND_FROM_EMAIL, to, subject, html },
      { headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" } }
    );

    console.log(`✅ Email sent — ${event} → ${to}`);
    return true;
  } catch (err) {
    console.error(`❌ Email failed — ${event} — ${err.response?.data?.message || err.message}`);
    return null;
  }
};

module.exports = sendEmail;
