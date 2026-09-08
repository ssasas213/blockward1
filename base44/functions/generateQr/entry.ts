/**
 * generateQr — returns a crisp SVG QR code for any short string (typically a
 * public profile URL). Open to all (profile sharing works signed-out); input
 * is capped so the endpoint can't be abused for oversized payloads. SVG keeps
 * it printable at any size with no image hosting.
 */
import QRCode from 'npm:qrcode@1.5.4';

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const body = await req.json().catch(() => ({}));
    const data = String(body.data || '').slice(0, 512);
    if (!data) return Response.json({ error: 'Missing data' }, { status: 400 });

    const width = Math.min(Math.max(Number(body.size) || 480, 128), 1024);
    const svg = await QRCode.toString(data, {
      type: 'svg',
      margin: 1,
      width,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172aff', light: '#ffffffff' },
    });

    return Response.json({ ok: true, svg });
  } catch (error) {
    return Response.json({ error: error?.message || 'Failed to generate QR' }, { status: 500 });
  }
}