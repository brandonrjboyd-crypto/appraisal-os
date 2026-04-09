export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { to, toName, fromName, role, inviteLink, matterId } = req.body;

  const roleLabels = {
    umpire: 'Umpire',
    carrier: 'Carrier Appraiser',
    ph: 'Policyholder Appraiser'
  };
  const roleLabel = roleLabels[role] || role;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'The Appraisal OS <onboarding@resend.dev>',
      to: [to],
      subject: `You have been invited to an appraisal proceeding`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:#005eb8;padding:20px 24px;">
            <h1 style="color:#fff;font-size:18px;margin:0;">The Appraisal OS</h1>
          </div>
          <div style="padding:28px 24px;border:1px solid #e0e0e0;border-top:none;">
            <p style="font-size:15px;color:#1a1a1a;">Hi ${toName},</p>
            <p style="font-size:14px;color:#444;line-height:1.6;">
              <strong>${fromName}</strong> has invited you to join an appraisal proceeding 
              (Matter ${matterId}) as <strong>${roleLabel}</strong>.
            </p>
            <p style="font-size:14px;color:#444;line-height:1.6;">
              Click the button below to accept the invitation and access the matter file.
            </p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${inviteLink}" 
                 style="background:#005eb8;color:#fff;padding:12px 28px;text-decoration:none;font-size:14px;font-weight:700;display:inline-block;">
                Accept Invitation
              </a>
            </div>
            <p style="font-size:12px;color:#888;">
              If you were not expecting this invitation, you can ignore this email.
            </p>
          </div>
        </div>
      `
    })
  });

  const data = await response.json();
  if (!response.ok) {
    return res.status(500).json({ error: data });
  }
  return res.status(200).json({ success: true });
}
