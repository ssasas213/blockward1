/**
 * checkHandleAvailability — public validation endpoint for handle claims.
 * Validates format (3–20 chars, lowercase letters/numbers/underscores) and
 * global uniqueness (active handles + permanently reserved history).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizeHandle, validateHandle, isHandleAvailable } from '../../shared/handles.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const handle = normalizeHandle(body.handle);

    const check = validateHandle(handle);
    if (!check.valid) {
      return Response.json({ available: false, reason: check.reason });
    }

    const available = await isHandleAvailable(base44.asServiceRole, handle, null);
    return Response.json({ available, reason: available ? null : 'That handle is already taken' });
  } catch (error) {
    return Response.json({ available: false, reason: error.message }, { status: 500 });
  }
}