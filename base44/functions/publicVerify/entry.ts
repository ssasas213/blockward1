/**
 * publicVerify — Public achievement verification endpoint.
 * Anyone can verify an achievement by its verify_id without logging in.
 * Returns the record, signatures, and school info for display on /Verify.
 *
 * Only returns data for verified statuses (delivered_to_vault, minted, archived).
 * Never exposes sensitive fields (private keys, internal IDs beyond what's needed).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const base44 = createClientFromRequest(req);

  let body;
  try { body = await req.json(); } catch (e) {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }

  const { verify_id } = body;
  if (!verify_id) return Response.json({ ok: false, error: 'Missing verify_id' }, { status: 400, headers: CORS });

  try {
    // Read the record by verify_id using service role (bypasses RLS for public access)
    const records = await base44.asServiceRole.entities.StudentRecord.filter({ verify_id });
    if (!records.length) {
      return Response.json({ ok: false, error: 'Achievement not found' }, { status: 404, headers: CORS });
    }

    const record = records[0];

    // Only return data for verified statuses
    const verifiedStatuses = ['delivered_to_vault', 'minted', 'archived'];
    if (!verifiedStatuses.includes(record.status)) {
      return Response.json({
        ok: true,
        record: {
          title: record.title,
          status: record.status,
          student_name: record.student_name,
        },
        isVerified: false,
        message: 'This achievement is still in the approval process.'
      }, { headers: CORS });
    }

    // Fetch signatures and school info in parallel
    const [signatures, schools] = await Promise.all([
      base44.asServiceRole.entities.DigitalSignature.filter({ record_id: record.id }),
      base44.asServiceRole.entities.School.filter({ id: record.school_id }),
    ]);

    const school = schools[0] || null;
    const teacherSig = signatures.find(s => s.signer_role === 'teacher') || null;
    const adminSig = signatures.find(s => s.signer_role === 'admin') || null;

    // Return only the fields needed for public display
    return Response.json({
      ok: true,
      isVerified: true,
      record: {
        title: record.title,
        description: record.description || null,
        category: record.category,
        date_achieved: record.date_achieved || null,
        student_name: record.student_name,
        student_email: record.student_email,
        class_name: record.class_name || null,
        verify_id: record.verify_id,
        status: record.status,
        points: record.points || 0,
        file_url: record.file_url || null,
        nft_image_url: record.nft_image_url || null,
        teacher_name: record.teacher_name || null,
        admin_name: record.admin_name || null,
        approved_at: record.approved_at || null,
        vault_delivered_at: record.vault_delivered_at || null,
      },
      school: school ? {
        name: school.name,
        logo_url: school.logo_url || null,
        org_type: school.org_type || 'school',
      } : null,
      teacherSignature: teacherSig ? {
        signer_name: teacherSig.signer_name,
        signer_title: teacherSig.signer_title || null,
        signature_type: teacherSig.signature_type,
        signature_value: teacherSig.signature_value,
        signed_at: teacherSig.signed_at,
      } : null,
      adminSignature: adminSig ? {
        signer_name: adminSig.signer_name,
        signer_title: adminSig.signer_title || null,
        signature_type: adminSig.signature_type,
        signature_value: adminSig.signature_value,
        signed_at: adminSig.signed_at,
      } : null,
    }, { headers: CORS });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
  }
});