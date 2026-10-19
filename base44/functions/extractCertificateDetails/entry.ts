// extractCertificateDetails — AI-assisted extraction of certificate details
// for Past Achievements. The AI only READS the uploaded certificate to suggest
// fields for the student to review; it never decides whether an achievement is
// authentic and its output is never trusted without the issuer's confirmation.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolveEffectiveActor } from '../../shared/testMode.ts';

const CATEGORIES = new Set(['certification', 'competition', 'academic', 'professional', 'course', 'training', 'award', 'challenge', 'other']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const clean = (v: any, max = 200) => {
  const s = String(v ?? '').trim();
  const lower = s.toLowerCase();
  return s && s.length > 1 && !['unknown', 'not visible', 'null', 'none', 'n/a', 'not specified'].includes(lower)
    ? s.slice(0, max)
    : null;
};

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const actor = await resolveEffectiveActor(base44);
    if (!actor.authorized) return Response.json({ error: actor.reason || 'Unauthorized' }, { status: actor.status || 401 });
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));

    const fileUrl = String(body.file_url || '').trim();
    if (!fileUrl) return Response.json({ error: 'Upload a certificate first' }, { status: 400 });

    // Private storage file_uri → short-lived signed URL the vision model can fetch.
    let llmUrl = fileUrl;
    if (!/^https?:\/\//i.test(fileUrl)) {
      const signed = await svc.integrations.Core.CreateFileSignedUrl({ file_uri: fileUrl, expires_in: 300 });
      llmUrl = signed?.signed_url;
      if (!llmUrl) return Response.json({ error: 'Could not read the uploaded file' }, { status: 400 });
    }

    const res = await svc.integrations.Core.InvokeLLM({
      prompt: [
        'You are reading a photo or PDF of an award/certificate to help its owner fill in an achievement form.',
        'Extract ONLY what is clearly legible in the document. Omit any field you cannot read confidently - never guess.',
        'For date_achieved use exactly YYYY-MM-DD (if only month/year is visible, use the first of that month).',
        'For category pick the single closest match from: certification, competition, academic, professional, course, training, award, challenge, other.',
        'For description write one plain sentence (max 200 chars) summarising what the achievement is, taken from the document.',
        'external_credential_id is any printed certificate/reference number.',
      ].join(' '),
      file_urls: [llmUrl],
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          issuer_org: { type: 'string' },
          date_achieved: { type: 'string' },
          category: { type: 'string' },
          description: { type: 'string' },
          external_credential_id: { type: 'string' },
        },
        required: [],
      },
    });

    const s = res || {};
    const cat = clean(s.category, 40);
    const suggestions = {
      title: clean(s.title, 200),
      issuer_org: clean(s.issuer_org, 200),
      date_achieved: DATE_RE.test(String(s.date_achieved || '')) ? s.date_achieved : null,
      category: cat && CATEGORIES.has(cat) ? cat : null,
      description: clean(s.description, 500),
      external_credential_id: clean(s.external_credential_id, 100),
    };

    return Response.json({ ok: true, suggestions });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not read the certificate' }, { status: 500 });
  }
}