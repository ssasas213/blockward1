/**
 * mintAndArchive — Admin OVERRIDE path. Archives to the SCHOOL'S shared Google Drive.
 * 
 * This is NOT the default. The default is student_drive (student archives from their vault).
 * Admins may only use this as an override, and MUST provide a reason.
 * 
 * Security:
 * - Admin must be authenticated and belong to same school as the record
 * - Record must be 'approved' or 'pending_student_drive' with both signatures
 * - override_reason is REQUIRED (audited)
 * - DriveVault stores archive_destination='admin_override' + connected_google_email (admin's)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: CORS });

  const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
  const profile = profiles[0];
  if (!profile) return Response.json({ ok: false, error: 'Profile not found' }, { status: 403, headers: CORS });
  if (profile.user_type !== 'admin') return Response.json({ ok: false, error: 'Admin only' }, { status: 403, headers: CORS });
  if (profile.status === 'inactive' || profile.status === 'suspended') {
    return Response.json({ ok: false, error: 'Account inactive' }, { status: 403, headers: CORS });
  }

  let body;
  try { body = await req.json(); } catch (e) {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }
  const { recordId, override_reason } = body;
  if (!recordId) return Response.json({ ok: false, error: 'Missing recordId' }, { status: 400, headers: CORS });
  if (!override_reason || !override_reason.trim()) {
    return Response.json({ ok: false, error: 'A reason is required for admin override archive' }, { status: 400, headers: CORS });
  }

  let record;
  try {
    const records = await base44.asServiceRole.entities.StudentRecord.filter({ id: recordId });
    if (!records.length) return Response.json({ ok: false, error: 'Record not found' }, { status: 404, headers: CORS });
    record = records[0];
  } catch (e) {
    return Response.json({ ok: false, error: 'Record not found' }, { status: 404, headers: CORS });
  }

  if (profile.school_id !== record.school_id) {
    return Response.json({ ok: false, error: 'Access denied: wrong school' }, { status: 403, headers: CORS });
  }
  if (!['approved', 'pending_student_drive'].includes(record.status)) {
    return Response.json({ ok: false, error: `Record must be 'approved' or 'pending_student_drive'. Current: '${record.status}'` }, { status: 409, headers: CORS });
  }
  if (!record.admin_signed || !record.teacher_signed) {
    return Response.json({ ok: false, error: 'Both teacher and admin signatures required before minting' }, { status: 409, headers: CORS });
  }

  const [signatures, auditLogs, schools] = await Promise.all([
    base44.asServiceRole.entities.DigitalSignature.filter({ record_id: recordId }),
    base44.asServiceRole.entities.AuditLog.filter({ record_id: recordId }),
    base44.asServiceRole.entities.School.filter({ id: record.school_id })
  ]);

  const teacherSig = signatures.find(s => s.signer_role === 'teacher');
  const adminSig = signatures.find(s => s.signer_role === 'admin');
  const school = schools[0];
  const schoolName = school?.name || 'School';
  const studentName = record.student_name || record.student_email;
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  // Build NFT metadata
  const nftMetadata = {
    name: record.title,
    description: record.description || '',
    image: record.file_url || '',
    attributes: [
      { trait_type: 'Category', value: record.category },
      { trait_type: 'Student', value: studentName },
      { trait_type: 'School', value: schoolName },
      { trait_type: 'Teacher', value: teacherSig?.signer_name || record.teacher_name || '' },
      { trait_type: 'Admin', value: adminSig?.signer_name || record.admin_name || '' },
      { trait_type: 'Date Achieved', value: record.date_achieved || dateStr },
      { trait_type: 'Date Minted', value: dateStr },
      { trait_type: 'Verify ID', value: record.verify_id || recordId },
    ],
    teacher_signature: {
      signer: teacherSig?.signer_name || record.teacher_name,
      title: teacherSig?.signer_title || '',
      signed_at: teacherSig?.signed_at || record.teacher_signed_at,
    },
    admin_signature: {
      signer: adminSig?.signer_name || record.admin_name,
      title: adminSig?.signer_title || '',
      signed_at: adminSig?.signed_at || record.admin_signed_at,
    },
    verification_url: `${Deno.env.get('APP_URL') || 'https://blockward.app'}/Verify?id=${record.verify_id || recordId}`,
    record_id: recordId,
    archived_to: 'admin_override',
    drive_owner_email: user.email,
    override_reason: override_reason,
  };

  // Build signed record HTML
  const sortedLogs = [...auditLogs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const auditRows = sortedLogs.map(l =>
    `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td>${l.actor_name} (${l.actor_role})</td><td>${l.action}</td><td>${l.notes || ''}</td></tr>`
  ).join('');

  const sigDisplay = (sig) => {
    if (!sig) return 'Not signed';
    if (sig.signature_type === 'drawn') return `<img src="${sig.signature_value}" style="max-height:60px;border:1px solid #ccc;border-radius:4px;"/>`;
    return `<span style="font-family:Georgia,serif;font-size:24px;font-style:italic;">${sig.signature_value}</span>`;
  };

  const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>BlockWard NFT Certificate — ${record.title}</title>
<style>
  body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1e293b;}
  h1{color:#5b21b6;border-bottom:3px solid #5b21b6;padding-bottom:10px;}
  h2{color:#374151;font-size:16px;margin-top:24px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .field{background:#f8fafc;padding:12px;border-radius:8px;}
  .field label{font-size:11px;color:#64748b;display:block;margin-bottom:4px;text-transform:uppercase;}
  .sig-box{background:#f8fafc;border:2px solid #c4b5fd;border-radius:8px;padding:16px;margin-top:8px;}
  .sig-box.teacher{border-color:#fcd34d;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th{background:#f1f5f9;padding:8px;text-align:left;border:1px solid #e2e8f0;}
  td{padding:8px;border:1px solid #e2e8f0;vertical-align:top;}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;}
  .verified{background:#d1fae5;color:#065f46;padding:12px 20px;border-radius:8px;font-weight:bold;text-align:center;margin-bottom:24px;}
  .nft-badge{background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;padding:16px 24px;border-radius:12px;text-align:center;margin-bottom:24px;}
  .override-notice{background:#fef3c7;color:#92400e;padding:10px 16px;border-radius:8px;font-size:13px;margin-bottom:24px;}
</style>
</head>
<body>
<h1>🎓 BlockWard — Verified NFT Achievement Certificate</h1>
<div class="nft-badge">
  <div style="font-size:24px;margin-bottom:8px;">✨ NFT ACHIEVEMENT</div>
  <div style="font-size:20px;font-weight:bold;">${record.title}</div>
  <div style="font-size:14px;opacity:0.85;margin-top:4px;">${schoolName} · ${dateStr}</div>
</div>
<div class="override-notice">⚠️ ADMIN OVERRIDE: Archived to school Drive (${user.email}). Reason: ${override_reason}</div>
<div class="verified">✅ VERIFIED — Signed by teacher and admin. Stored on Google Drive.</div>
<h2>Achievement Details</h2>
<div class="grid">
  <div class="field"><label>Student</label><span>${studentName}</span></div>
  <div class="field"><label>Category</label><span>${record.category}</span></div>
  <div class="field"><label>Date Achieved</label><span>${record.date_achieved || dateStr}</span></div>
  <div class="field"><label>School</label><span>${schoolName}</span></div>
</div>
${record.description ? `<div class="field" style="margin-top:12px;"><label>Description</label><span>${record.description}</span></div>` : ''}
<h2>Signatures</h2>
<div class="sig-box teacher">
  <label style="font-size:12px;color:#64748b;font-weight:600;">📚 Teacher Endorsement</label>
  <div style="margin-top:8px;">${sigDisplay(teacherSig)}</div>
  <p style="font-size:12px;color:#64748b;margin-top:6px;">
    ${teacherSig?.signer_name || record.teacher_name || 'N/A'} — ${teacherSig?.signer_title || ''}<br/>
    Signed: ${teacherSig?.signed_at ? new Date(teacherSig.signed_at).toLocaleString() : 'N/A'}
  </p>
</div>
<div class="sig-box" style="margin-top:12px;">
  <label style="font-size:12px;color:#64748b;font-weight:600;">🛡️ Admin Approval</label>
  <div style="margin-top:8px;">${sigDisplay(adminSig)}</div>
  <p style="font-size:12px;color:#64748b;margin-top:6px;">
    ${adminSig?.signer_name || record.admin_name || 'N/A'} — ${adminSig?.signer_title || ''}<br/>
    Signed: ${adminSig?.signed_at ? new Date(adminSig.signed_at).toLocaleString() : 'N/A'}
  </p>
</div>
<h2>Audit Trail</h2>
<table>
  <thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Notes</th></tr></thead>
  <tbody>${auditRows}</tbody>
</table>
<div class="footer">
  <p>Generated by BlockWard on ${now.toISOString()} | Record ID: ${recordId}</p>
  <p>Archived to: School Drive (${user.email}) — Admin Override</p>
  <p>Verify at: ${nftMetadata.verification_url}</p>
</div>
</body>
</html>`;

  // Get shared (school) Drive token
  let accessToken;
  try {
    const conn = await base44.asServiceRole.connectors.getConnection('googledrive');
    accessToken = conn.accessToken;
  } catch (e) {
    return Response.json({ ok: false, error: 'School Google Drive not connected: ' + e.message }, { status: 503, headers: CORS });
  }

  const authHeader = { Authorization: `Bearer ${accessToken}` };

  async function findOrCreateFolder(name, parentId) {
    const query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentId ? ` and '${parentId}' in parents` : ''}`;
    const searchRes = await fetch(`${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, { headers: authHeader });
    if (searchRes.ok) {
      const { files } = await searchRes.json();
      if (files && files.length > 0) return files[0].id;
    }
    const res = await fetch(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parentId ? { parents: [parentId] } : {}) })
    });
    if (!res.ok) throw new Error(`Folder create failed '${name}': ${await res.text()}`);
    return (await res.json()).id;
  }

  async function uploadFile(name, mimeType, content, parentId) {
    const boundary = 'BlockWardBoundary';
    const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name, mimeType, parents: [parentId] })}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`;
    const res = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,webViewLink`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': `multipart/related; boundary="${boundary}"` },
      body
    });
    if (!res.ok) throw new Error(`Upload failed '${name}': ${await res.text()}`);
    return await res.json();
  }

  try {
    const rootId = await findOrCreateFolder('BlockWard', null);
    const schoolId = await findOrCreateFolder(schoolName, rootId);
    const studId = await findOrCreateFolder(studentName, schoolId);
    const nftId = await findOrCreateFolder('NFTs', studId);

    const safeName = `${record.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 40)}_${dateStr}`;

    const [metaFile, certFile] = await Promise.all([
      uploadFile(`${safeName}_Metadata.json`, 'application/json', JSON.stringify(nftMetadata, null, 2), nftId),
      uploadFile(`${safeName}_Certificate.html`, 'text/html', htmlDoc, nftId)
    ]);

    const driveFileUrl = certFile.webViewLink || `https://drive.google.com/file/d/${certFile.id}/view`;
    const folderPath = `BlockWard / ${schoolName} / ${studentName} / NFTs`;
    const actorName = `${profile.first_name} ${profile.last_name}`;

    // Update StudentRecord
    await base44.asServiceRole.entities.StudentRecord.update(recordId, {
      status: 'archived',
      nft_metadata: nftMetadata,
      minted_at: now.toISOString(),
      drive_file_url: driveFileUrl,
      drive_file_id: certFile.id,
      drive_folder_path: folderPath,
      drive_archive_destination: 'admin_override',
      drive_connected_email: user.email,
      override_reason: override_reason,
      approved_at: record.approved_at || now.toISOString()
    });

    // Create DriveVault entry with ownership info
    await base44.asServiceRole.entities.DriveVault.create({
      student_email: record.student_email,
      record_id: recordId,
      school_id: record.school_id,
      drive_file_id: certFile.id,
      drive_folder_path: folderPath,
      drive_url: driveFileUrl,
      metadata_file_id: metaFile.id,
      certificate_file_id: certFile.id,
      saved_at: now.toISOString(),
      status: 'saved',
      connected_google_email: user.email,
      drive_owner_user_id: user.id,
      archive_destination: 'admin_override',
    });

    // Audit log with override reason
    await base44.asServiceRole.entities.AuditLog.create({
      record_id: recordId,
      school_id: record.school_id,
      actor_email: user.email,
      actor_name: actorName,
      actor_role: 'admin',
      action: 'drive_saved',
      old_status: record.status,
      new_status: 'archived',
      notes: `ADMIN OVERRIDE — Archived to school Drive (${user.email}). Reason: ${override_reason}. Path: ${folderPath}`,
      timestamp: now.toISOString()
    });

    return Response.json({ ok: true, driveFileUrl, folderPath, certFileId: certFile.id, metadataFileId: metaFile.id, archiveDestination: 'admin_override' }, { headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500, headers: CORS });
  }
});