/**
 * checkHandleAvailability — public validation endpoint for handle claims.
 * Validates format (3–20 chars, lowercase letters/numbers/underscores) and
 * global uniqueness (active handles + permanently reserved history + the
 * deliberate-release reservation list). When a handle is taken it also
 * returns near-miss suggestions that ARE available, so the UI can say
 * "@maya is taken. @maya_ is available."
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizeHandle, validateHandle, isHandleAvailable, suggestHandles } from '../../shared/handles.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const handle = normalizeHandle(body.handle);

    const check = validateHandle(handle);
    if (!check.valid) {
      return Response.json({ available: false, reason: check.reason });
    }

    const availability = await isHandleAvailable(svc, handle, null);
    if (availability.available) {
      return Response.json({ available: true, reason: null, suggestions: [] });
    }

    // Taken or reserved — offer near-misses that are free right now.
    let suggestions: string[] = [];
    if (!availability.reserved) {
      try { suggestions = await suggestHandles(svc, handle, null); } catch (e) { /* ignore */ }
    }

    return Response.json({
      available: false,
      reason: availability.reason + (suggestions.length ? ' — but @' + suggestions.join(', @') + ' ' + (suggestions.length === 1 ? 'is' : 'are') + ' available' : ''),
      reserved: availability.reserved,
      suggestions,
    });
  } catch (error) {
    return Response.json({ available: false, reason: error.message }, { status: 500 });
  }
}