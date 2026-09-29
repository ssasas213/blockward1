// ============================================================================
// issuerEmails — branded transactional email templates for the Blockward
// verification loop. All sends go through sendTrackedEmail (best-effort,
// deduped, logged); these functions only BUILD the HTML.
// ============================================================================

const BRAND = {
  bg: '#0f0d1a',
  card: '#ffffff',
  ink: '#17121f',
  sub: '#6f6878',
  accent: '#7c3aed',
  accentDark: '#5b21b6',
  border: '#e6e2ef',
};

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
  <div style="font-size:12px;color:#8f8aa3;line-height:1.6;">This is an automated message from Blockward.<br/>You are receiving this because of an achievement verification request or your Blockward account.</div>
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
function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const VERIFICATION_METHODS: Record<string, string> = {
  witnessed_in_person: 'Witnessed in person',
  reviewed_evidence: 'Reviewed the evidence',
  official_records: 'Checked official records',
  third_party: 'Third-party confirmation',
  other: 'Other verification method',
};
export function methodLabel(m?: string | null): string {
  return VERIFICATION_METHODS[m] || 'Reviewed the evidence';
}

// ── To the ISSUER ──
export function issuerVerificationRequestEmail(d: {
  holderName: string; achievementTitle: string; issuerOrg: string;
  dateAchieved?: string; credentialId?: string; category?: string; reviewUrl: string; expiresInDays: number;
}) {
  const title = `Verification request: ${d.achievementTitle}`;
  const body = `
  ${h2('Blockward Achievement Verification Request')}
  ${p(`${d.holderName} has listed an achievement associated with your organisation on Blockward and requests your confirmation that it is genuine.`)}
  ${detailTable([
    ['Holder', d.holderName],
    ['Achievement', d.achievementTitle],
    ['Organisation', d.issuerOrg],
    ['Date achieved', d.dateAchieved || '—'],
    ['Credential ID on certificate', d.credentialId || '—'],
  ])}
  ${p('Please review the submitted certificate and confirm whether this achievement was legitimately issued to this person.')}
  ${btn(d.reviewUrl, 'Review Achievement')}
  ${sub(`This secure link is unique to this request and expires in ${d.expiresInDays} days. No Blockward account is needed — just the link.`)}
  ${sub(`If you did not issue this achievement, open the link and choose "Cannot Verify" — nothing will be published.`)}`;
  return { subject: title, html: shell(title, body) };
}

export function issuerReminderEmail(d: {
  holderName: string; achievementTitle: string; issuerOrg: string; reviewUrl: string; expiresInDays: number;
}) {
  const title = `Reminder: verification request for ${d.achievementTitle}`;
  const body = `
  ${h2('Verification request still waiting')}
  ${p(`${d.holderName} is still waiting for your confirmation on the achievement "${d.achievementTitle}" (${d.issuerOrg}).`)}
  ${btn(d.reviewUrl, 'Review Achievement')}
  ${sub(`This secure link expires in ${d.expiresInDays} days. No account needed.`)}`;
  return { subject: title, html: shell(title, body) };
}

// ── To the HOLDER ──
export function holderApprovedEmail(d: { achievementTitle: string; issuerOrg: string }) {
  const title = `Verification approved: ${d.achievementTitle}`;
  const body = `
  ${h2('Your achievement was confirmed')}
  ${p(`${d.issuerOrg} has confirmed your achievement "${d.achievementTitle}". Your blockchain proof is now being created — once it is secured, your credential becomes Blockward Verified.`)}
  ${sub('You will be notified when the blockchain proof is complete.')}`;
  return { subject: title, html: shell(title, body) };
}

export function holderRejectedEmail(d: { achievementTitle: string; issuerOrg: string; reason?: string }) {
  const title = `Verification declined: ${d.achievementTitle}`;
  const body = `
  ${h2('Verification was declined')}
  ${p(`${d.issuerOrg} could not verify your achievement "${d.achievementTitle}". The achievement remains on your profile as unverified and nothing was published.`)}
  ${d.reason ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${BRAND.ink};background:#f7f5fb;border:1px solid ${BRAND.border};border-radius:10px;padding:14px;">Reason: ${escapeHtml(d.reason)}</p>` : ''}
  ${sub('You may edit the details and submit a new verification request to a different issuer contact at any time.')}`;
  return { subject: title, html: shell(title, body) };
}

export function holderVerifiedEmail(d: { achievementTitle: string; bwId: string; verifyUrl: string }) {
  const title = `Blockward Verified: ${d.achievementTitle}`;
  const body = `
  ${h2('Your achievement is now Blockward Verified')}
  ${p(`"${d.achievementTitle}" has been confirmed by its issuer and secured on the blockchain. Anyone can confirm it instantly using your public verification link.`)}
  ${detailTable([['Blockward Credential ID', d.bwId]])}
  ${btn(d.verifyUrl, 'View Verification Page')}
  ${sub('Share this link on your CV, LinkedIn or certificates — anyone who opens it can confirm the achievement is genuine and unaltered.')}`;
  return { subject: title, html: shell(title, body) };
}

export function holderRevokedEmail(d: { achievementTitle: string; reason: string }) {
  const title = `Credential revoked: ${d.achievementTitle}`;
  const body = `
  ${h2('Your credential has been revoked')}
  ${p(`The Blockward Verified credential for "${d.achievementTitle}" has been revoked. The original blockchain record remains for the audit trail, and the public verification page now shows the credential as revoked.`)}
  ${d.reason ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${BRAND.ink};background:#f7f5fb;border:1px solid ${BRAND.border};border-radius:10px;padding:14px;">Reason: ${escapeHtml(d.reason)}</p>` : ''}`;
  return { subject: title, html: shell(title, body) };
}