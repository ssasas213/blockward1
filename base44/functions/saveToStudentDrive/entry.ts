/**
 * saveToStudentDrive — Called by the STUDENT from their Portfolio Vault page.
 * 
 * Uses the student's OWN per-user OAuth connection (app-user connector)
 * to archive the certificate + metadata to the student's personal Google Drive.
 * 
 * Security:
 * - Student must be authenticated and own the record (student_email === user.email)
 * - Record must be 'approved' or 'pending_student_drive' with both signatures
 * - Only the student's own Drive token is used
 * - DriveVault stores connected_google_email + drive_owner_user_id for audit
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
const STUDENT_DRIVE_CONNECTOR_ID = '6a2967c08ac8557a7b3a1b2e';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: CORS });

  const body = await req.json();
  const { recordId } = body;
  if (!recordId) return Response.json({ ok: false, error: 'Missing recordId' }, { headers: CORS });

  // Fetch record
  let record;
  try {
    const records = await base44.asServiceRole.entities.StudentRecord.filter({ id: recordId });
    if (!records.length) return Response.json({ ok: false, error: 'Record not found' }, { status: 404, headers: CORS });
    record = records[0];
  } catch (e) {
    return Response.json({ ok: false, error: 'Record not found' }, { status: 404, headers: CORS });
  }

  // Student must own this record
  if (record.student_email !== user.email) {
    return Response.json({ ok: false, error: 'Only the student can archive to their own Drive' }, { status: 403, headers: CORS });
  }

  // Record must be approved or pending_student_drive
  if (!['approved', 'pending_student_drive'].includes(record.status)) {
    return Response.json({ ok: false, error: `Record must be 'approved' or 'pending_student_drive'. Current: '${record.status}'` }, { status: 409, headers: CORS });
  }

  if (!record.admin_signed || !record.teacher_signed) {
    return Response.json({ ok: false, error: 'Both teacher and admin signatures required' }, { status: 409, headers: CORS });
  }

  // Get the STUDENT'S OWN Drive token (per-user OAuth)
  let accessToken;
  try {
    const conn = await base44.asServiceRole.connectors.getCurrentAppUserConnection(STUDENT_DRIVE_CONNECTOR_ID);
    accessToken = conn.accessToken;
  } catch (e) {
    return Response.json({
      ok: false,
      error: 'You have not connected your Google Drive. Please connect it from the Portfolio Vault page.',
      needs_student_drive: true
    }, { status: 200, headers: CORS });
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
  const verifyId = record.verify_id || recordId;
  const nftMetadata = {
    name: record.title,
    description: record.description || '',
    image: record.file_url || '',
    attributes: [
      { trait_type: 'Category', value: record.category },
      { trait_type: 'Student', value: studentName },
      { trait_type: 'School', value: schoolName },
      { trait_type: 'Teacher', value: record.teacher_name || '' },
      { trait_type: 'Admin', value: record.admin_name || '' },
      { trait_type: 'Date Achieved', value: record.date_achieved || dateStr },
      { trait_type: 'Date Minted', value: dateStr },
      { trait_type: 'Verify ID', value: verifyId },
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
    verification_url: `${Deno.env.get('APP_URL') || 'https://blockward.app'}/Verify?id=${verifyId}`,
    record_id: recordId,
    archived_to: 'student_drive',
    drive_owner_email: user.email,
  };

  // Build signed HTML certificate
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
<head><meta charset="UTF-8"/><title>BlockWard Certificate — ${record.title}</title>
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
  .nft-badge{background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;padding:16px 24px;border-radius:12px;text-align:center;margin-bottom:24px;}
  .verified{background:#d1fae5;color:#065f46;padding:12px 20px;border-radius:8px;font-weight:bold;text-align:center;margin-bottom:24px;}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;}
</style>
</head>
<body>
<h1>🎓 BlockWard — Verified Achievement Certificate</h1>
<div class="nft-badge">
  <div style="font-size:24px;margin-bottom:8px;">✨ VERIFIED ACHIEVEMENT</div>
  <div style="font-size:20px;font-weight:bold;">${record.title}</div>
  <div style="font-size:14px;opacity:0.85;margin-top:4px;">${schoolName} · ${dateStr}</div>
</div>
<div class="verified">✅ VERIFIED — Signed by teacher and admin. Archived to student's Google Drive.</div>
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
  <p>Archived to: ${user.email}'s Google Drive</p>
  <p>Verify at: ${nftMetadata.verification_url}</p>
</div>
</body></html>`;

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

  async function uploadTextFile(name, mimeType, content, parentId) {
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

  // Upload a binary file (evidence) to Drive by fetching from URL
  async function uploadBinaryFile(name, mimeType, contentBytes, parentId) {
    const boundary = 'BlockWardBoundary';
    const metadata = JSON.stringify({ name, mimeType, parents: [parentId] });
    const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const bodyBytes = new Uint8Array(body.length + contentBytes.length + `\r\n--${boundary}--`.length);
    bodyBytes.set(new TextEncoder().encode(body), 0);
    bodyBytes.set(contentBytes, body.length);
    bodyBytes.set(new TextEncoder().encode(`\r\n--${boundary}--`), body.length + contentBytes.length);
    const res = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,webViewLink`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': `multipart/related; boundary="${boundary}"` },
      body: bodyBytes
    });
    if (!res.ok) throw new Error(`Evidence upload failed '${name}': ${await res.text()}`);
    return await res.json();
  }

  // Category → Drive folder name mapping
  const CATEGORY_FOLDERS = {
    academic: 'Academic Achievements',
    sports: 'Sports Achievements',
    arts: 'Arts & Music',
    leadership: 'Leadership',
    community: 'Community Service',
    behaviour: 'Other Achievements',
    special: 'Other Achievements',
  };

  try {
    // Create folder structure: BlockWard / {Category} / {Record Title}
    const rootId = await findOrCreateFolder('BlockWard', null);
    const categoryName = CATEGORY_FOLDERS[record.category] || 'Other Achievements';
    const categoryFolderId = await findOrCreateFolder(categoryName, rootId);
    const safeTitle = record.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').slice(0, 50);
    const recordFolderId = await findOrCreateFolder(`${safeTitle}_${dateStr}`, categoryFolderId);

    const safeName = safeTitle + `_${dateStr}`;

    const metaFile = await uploadTextFile(`${safeName}_Metadata.json`, 'application/json', JSON.stringify(nftMetadata, null, 2), recordFolderId);
    const certFile = await uploadTextFile(`${safeName}_Certificate.html`, 'text/html', htmlDoc, recordFolderId);

    // Upload evidence file if it exists
    let evidenceFile = null;
    if (record.file_url) {
      try {
        const evidenceRes = await fetch(record.file_url);
        if (evidenceRes.ok) {
          const evidenceBytes = new Uint8Array(await evidenceRes.arrayBuffer());
          const evidenceMime = evidenceRes.headers.get('content-type') || 'application/octet-stream';
          const ext = record.file_type || (evidenceMime.includes('image') ? 'img' : 'file');
          evidenceFile = await uploadBinaryFile(`${safeName}_Evidence.${ext}`, evidenceMime, evidenceBytes, recordFolderId);
        }
      } catch (e) { /* evidence upload is best-effort */ }
    }

    const driveUrl = certFile.webViewLink || `https://drive.google.com/file/d/${certFile.id}/view`;
    const folderPath = `BlockWard / ${categoryName} / ${safeTitle}_${dateStr}`;

    // Update StudentRecord
    await base44.asServiceRole.entities.StudentRecord.update(recordId, {
      status: 'archived',
      nft_metadata: nftMetadata,
      minted_at: now.toISOString(),
      drive_file_url: driveUrl,
      drive_file_id: certFile.id,
      drive_folder_path: folderPath,
      drive_archive_destination: 'student_drive',
      drive_connected_email: user.email,
    });

    // Create DriveVault entry with ownership info
    await base44.asServiceRole.entities.DriveVault.create({
      student_email: record.student_email,
      record_id: recordId,
      school_id: record.school_id,
      drive_file_id: certFile.id,
      drive_folder_path: folderPath,
      drive_url: driveUrl,
      metadata_file_id: metaFile.id,
      certificate_file_id: certFile.id,
      saved_at: now.toISOString(),
      status: 'saved',
      connected_google_email: user.email,
      drive_owner_user_id: user.id,
      archive_destination: 'student_drive',
    });

    // Update student profile with connected Google email
    const studentProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: record.student_email });
    if (studentProfiles.length > 0) {
      await base44.asServiceRole.entities.UserProfile.update(studentProfiles[0].id, {
        connected_google_email: user.email,
        drive_connected_at: now.toISOString(),
      });
    }

    // Audit
    await base44.asServiceRole.entities.AuditLog.create({
      record_id: recordId,
      school_id: record.school_id,
      actor_email: user.email,
      actor_name: studentName,
      actor_role: 'student',
      action: 'drive_saved',
      old_status: record.status,
      new_status: 'archived',
      notes: `NFT archived to student's own Google Drive (${user.email}): ${folderPath}${evidenceFile ? ' (evidence included)' : ''}`,
      timestamp: now.toISOString()
    });

    return Response.json({ ok: true, driveUrl, folderPath, certFileId: certFile.id, evidenceFileId: evidenceFile?.id, connectedEmail: user.email }, { headers: CORS });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500, headers: CORS });
  }
});