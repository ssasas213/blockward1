// ============================================================================
// orgEmails — branded transactional emails for the Issuer Organisation /
// Verifier workflow. All sends go through sendTrackedEmail (best-effort,
// deduped, logged); these functions only BUILD the HTML.
// ============================================================================

const BRAND = {
  bg: '#0f0d1a',
  card: '#ffffff',
  ink: '#17121f',
  sub: '#6f6878',
  accent: '#7c3aed',
  border: '#e6e2ef',
};

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 8px 20px;" align="center">
  <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:1px;">BLOCK<span style="color:#a78bfa;">WARD</span></span>
  <div style="font-size:11px;color:#8f8aa3;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">Issuer Verified &middot; Blockchain Secured</div>
</td></tr>
<tr><td style="background:${BRAND.card};border-radius:16px;padding:32px;box-shadow:0 8px 40px rgba(0,0,0,.35);">
  ${bodyHtml}
</td></tr>
<tr><td style="padding:20px 8px;" align="center">
  <div style="font-size:12px;color:#8f8aa3;line-height:1.6;">This is an automated message from Blockward.</div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
function h2(text: string): string {
  return `<h2 style="margin:0 0 12px;font-size:20px;color:${BRAND.ink};">${escapeHtml(text)}</h2>`;
}
function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND.ink};">${escapeHtml(text)}</p>`;
}
function sub(text: string): string {
  return `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${BRAND.sub};">${escapeHtml(text)}</p>`;
}
function btn(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="background:${BRAND.accent};border-radius:10px;">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
</td></tr></table>`;
}
function detailTable(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5fb;border:1px solid ${BRAND.border};border-radius:10px;padding:4px 0;margin:0 0 20px;">${rows
    .map(([k, v]) => `<tr><td style="padding:9px 16px;font-size:13px;color:${BRAND.sub};width:38%;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:9px 16px 9px 0;font-size:14px;font-weight:600;color:${BRAND.ink};vertical-align:top;">${escapeHtml(v || '—')}</td></tr>`)
    .join('')}</table>`;
}

// ── To the invited VERIFIER ──
export function verifierInviteEmail(d: { orgName: string; inviteeName?: string; jobTitle?: string; invitedBy: string; joinUrl: string }) {
  return {
    subject: `You've been invited to become a Verifier for ${d.orgName}`,
    html: shell(d.orgName, `
      ${h2('Verifier invitation')}
      ${p(`Hi ${d.inviteeName || 'there'} — ${d.invitedBy} has invited you to become a Verifier for ${d.orgName} on Blockward.`)}
      ${d.jobTitle ? detailTable([['Organisation', d.orgName], ['Your role', d.jobTitle], ['Invited by', d.invitedBy]]) : ''}
      ${p('As a Verifier, you confirm that achievements submitted to your organisation were legitimately issued. Every credential you sign carries your name and role — human accountability behind every verification.')}
      ${btn(d.joinUrl, 'Accept invitation')}
      ${sub('You will sign in with this email address, set up your digital signature once, and explicitly authorise each verification you sign.')}
    `),
  };
}

// ── To the ORGANISATION (new verification request) ──
export function orgNewRequestEmail(d: { orgName: string; holderName: string; achievementTitle: string; dateAchieved?: string; credentialId?: string; dashboardUrl: string }) {
  return {
    subject: `A new achievement is awaiting your verification — ${d.achievementTitle}`,
    html: shell(d.orgName, `
      ${h2('New verification request')}
      ${p(`${d.holderName} has asked ${d.orgName} to verify an achievement.`)}
      ${detailTable([['Holder', d.holderName], ['Achievement', d.achievementTitle], ['Date achieved', d.dateAchieved || '—'], ['Credential ID', d.credentialId || '—']])}
      ${btn(d.dashboardUrl, 'Open verification queue')}
      ${sub('Only an authorised, active Verifier of your organisation can review and sign. The request expires if not actioned.')}
    `),
  };
}

// ── To the remaining VERIFIERS (joint verification) ──
export function additionalSignatureEmail(d: { orgName: string; achievementTitle: string; holderName: string; signedBy: string; dashboardUrl: string }) {
  return {
    subject: `Your signature is required to complete a joint verification — ${d.achievementTitle}`,
    html: shell(d.orgName, `
      ${h2('Additional signature required')}
      ${p(`${d.signedBy} has signed the verification of "${d.achievementTitle}" for ${d.holderName}. More signatures are required before issuer verification is complete.`)}
      ${btn(d.dashboardUrl, 'Review and sign')}
      ${sub('Your stored signature is only ever attached when YOU explicitly authorise a verification.')}
    `),
  };
}

// ── To the suggested ORGANISATION (holder suggested them) ──
export function issuerJoinInviteEmail(d: { orgName: string; holderName: string; registerUrl: string }) {
  return {
    subject: `Your organisation has received a Blockward verification request`,
    html: shell(d.orgName, `
      ${h2('A holder has requested verification from your organisation')}
      ${p(`${d.holderName} has submitted an achievement issued by ${d.orgName} and would like it verified on Blockward.`)}
      ${p('Blockward is a blockchain-backed achievement verification platform: trusted organisations verify achievements, authorised people digitally sign those verifications, and the resulting credential is anchored to Polygon — issuer verified, blockchain secured, instantly verifiable.')}
      ${btn(d.registerUrl, `Register ${d.orgName}`)}
      ${sub('An authorised representative can register the organisation. Blockward verifies organisations before they receive full issuing authority.')}
    `),
  };
}

// ── To the HOLDER (progress updates) ──
export function holderSignatureReceivedEmail(d: { achievementTitle: string; orgName: string; verifierName: string; signaturesSoFar: number; required: number }) {
  const complete = d.signaturesSoFar >= d.required;
  return {
    subject: complete
      ? `Issuer verification complete — "${d.achievementTitle}"`
      : `New signature received — "${d.achievementTitle}"`,
    html: shell(d.orgName, `
      ${h2(complete ? 'Issuer verification complete' : 'Verification progress')}
      ${p(`${d.verifierName} (${d.orgName}) has signed the verification of "${d.achievementTitle}".`)}
      ${detailTable([['Signatures', `${d.signaturesSoFar} of ${d.required}`]])}
      ${complete
        ? p('Issuer verification is complete — your credential is now being created and anchored to the Polygon blockchain.')
        : p('More signatures are required before issuer verification is complete. We will notify you as each signature arrives.')}
    `),
  };
}