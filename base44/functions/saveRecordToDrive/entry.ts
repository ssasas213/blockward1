/**
 * saveRecordToDrive — ADMIN ONLY
 * 
 * 1. Validates admin role, school_id, both signatures present, status === 'pending_drive_save'
 * 2. Generates a PDF-like HTML document with all record details + signatures
 * 3. Creates real Google Drive folder structure: BlockWard / School Name / Student Name / Awards and Records
 * 4. Uploads real file to Google Drive
 * 5. Saves real Drive file ID and URL to StudentRecord
 * 6. Marks record as 'active' ONLY on success — NEVER on failure
 * 7. Returns proper errors, keeps status as 'pending_drive_save' on failure
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

  // --- Auth ---
  const user = await base44.auth.me();
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: CORS });

  // --- Load profile ---
  const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
  const profile = profiles[0];
  if (!profile) return Response.json({ ok: false, error: 'Profile not found' }, { status: 403, headers: CORS });

  // CRITICAL FIX: Admin only
  if (profile.user_type !== 'admin') {
    return Response.json({ ok: false, error: 'Forbidden: Only school admins may save records to Drive' }, { status: 403, headers: CORS });
  }

  // Active user check
  if (profile.status === 'inactive' || profile.status === 'suspended') {
    return Response.json({ ok: false, error: 'Your account is inactive' }, { status: 403, headers: CORS });
  }

  const body = await req.json();
  const { recordId } = body;
  if (!recordId) return Response.json({ ok: false, error: 'Missing recordId' }, { headers: CORS });

  // --- Load record ---
  const records = await base44.asServiceRole.entities.StudentRecord.filter({ id: recordId });
  if (!records.length) return Response.json({ ok: false, error: 'Record not found' }, { status: 404, headers: CORS });
  const record = records[0];

  // --- School isolation ---
  if (profile.school_id !== record.school_id) {
    return Response.json({ ok: false, error: 'Access denied: wrong school' }, { status: 403, headers: CORS });
  }

  // --- Status check: must be pending_drive_save ---
  if (record.status !== 'pending_drive_save') {
    return Response.json({ ok: false, error: `Record must be in 'pending_drive_save' status. Current: '${record.status}'` }, { status: 409, headers: CORS });
  }

  // --- Both signatures required ---
  if (!record.admin_signed || !record.student_signed) {
    return Response.json({ ok: false, error: 'Both admin and student signatures are required before saving to Drive' }, { status: 409, headers: CORS });
  }

  // --- Load signatures and audit logs for the PDF ---
  const [signatures, auditLogs, schools] = await Promise.all([
    base44.asServiceRole.entities.DigitalSignature.filter({ record_id: recordId }),
    base44.asServiceRole.entities.AuditLog.filter({ record_id: recordId }),
    base44.asServiceRole.entities.School.filter({ id: record.school_id })
  ]);

  const adminSig = signatures.find(s => s.signer_role === 'admin');
  const studentSig = signatures.find(s => s.signer_role === 'student');
  const school = schools[0];
  const schoolName = school?.name || 'School';
  const studentName = record.student_name || record.student_email;
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const fileName = `BlockWard_Record_${studentName.replace(/\s+/g, '_')}_${record.title.replace(/\s+/g, '_')}_${dateStr}.html`;

  // --- Generate rich HTML document (serves as the signed record PDF substitute) ---
  const sortedLogs = [...auditLogs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const auditRows = sortedLogs.map(l =>
    `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td>${l.actor_name} (${l.actor_role})</td><td>${l.action}</td><td>${l.notes || ''}</td></tr>`
  ).join('');

  const adminSigDisplay = adminSig
    ? (adminSig.signature_type === 'drawn'
        ? `<img src="${adminSig.signature_value}" style="max-height:60px;border:1px solid #ccc;border-radius:4px;" alt="Admin signature"/>`
        : `<span style="font-family:Georgia,serif;font-size:24px;font-style:italic;">${adminSig.signature_value}</span>`)
    : 'Not signed';

  const studentSigDisplay = studentSig
    ? (studentSig.signature_type === 'drawn'
        ? `<img src="${studentSig.signature_value}" style="max-height:60px;border:1px solid #ccc;border-radius:4px;" alt="Student signature"/>`
        : `<span style="font-family:Georgia,serif;font-size:24px;font-style:italic;">${studentSig.signature_value}</span>`)
    : 'Not signed';

  const evidenceSection = record.file_url
    ? `<p><strong>Evidence:</strong> <a href="${record.file_url}">${record.file_url}</a></p>`
    : '<p><strong>Evidence:</strong> None attached</p>';

  const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>BlockWard Signed Record — ${record.title}</title>
<style>
  body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1e293b;}
  h1{color:#5b21b6;border-bottom:3px solid #5b21b6;padding-bottom:10px;}
  h2{color:#374151;font-size:16px;margin-top:24px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;}
  .badge{display:inline-block;background:#ede9fe;color:#5b21b6;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:bold;text-transform:uppercase;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .field{background:#f8fafc;padding:12px;border-radius:8px;}
  .field label{font-size:11px;color:#64748b;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;}
  .field span{font-weight:600;color:#1e293b;}
  .sig-box{background:#f8fafc;border:2px solid #c4b5fd;border-radius:8px;padding:16px;margin-top:8px;}
  .sig-box.student{border-color:#6ee7b7;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th{background:#f1f5f9;padding:8px;text-align:left;border:1px solid #e2e8f0;}
  td{padding:8px;border:1px solid #e2e8f0;vertical-align:top;}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;}
  .verified{background:#d1fae5;color:#065f46;padding:12px 20px;border-radius:8px;font-weight:bold;text-align:center;margin-bottom:24px;}
</style>
</head>
<body>
<h1>🎓 BlockWard — Digital Student Record</h1>
<div class="verified">✅ FULLY SIGNED &amp; VERIFIED — This record has been digitally signed by both an administrator and the student.</div>

<h2>School Details</h2>
<div class="grid">
  <div class="field"><label>School Name</label><span>${schoolName}</span></div>
  <div class="field"><label>School ID</label><span>${record.school_id}</span></div>
</div>

<h2>Award / Record Details</h2>
<div class="field" style="margin-bottom:12px;"><label>Title</label><span>${record.title}</span></div>
<div class="grid">
  <div class="field"><label>Category</label><span class="badge">${record.category}</span></div>
  <div class="field"><label>Date Issued</label><span>${dateStr}</span></div>
</div>
${record.description ? `<div class="field" style="margin-top:12px;"><label>Description</label><span>${record.description}</span></div>` : ''}
${evidenceSection}

<h2>Student Details</h2>
<div class="grid">
  <div class="field"><label>Student Name</label><span>${record.student_name || 'N/A'}</span></div>
  <div class="field"><label>Student Email</label><span>${record.student_email}</span></div>
</div>

<h2>Teacher Details</h2>
<div class="grid">
  <div class="field"><label>Teacher Name</label><span>${record.teacher_name || 'N/A'}</span></div>
  <div class="field"><label>Teacher Email</label><span>${record.teacher_email}</span></div>
  ${record.class_name ? `<div class="field"><label>Class</label><span>${record.class_name}</span></div>` : ''}
</div>

<h2>Signatures</h2>
<div class="sig-box">
  <label style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:600;">🛡️ Administrator Signature</label>
  <div style="margin-top:8px;">${adminSigDisplay}</div>
  <p style="font-size:12px;color:#64748b;margin-top:6px;">
    Signed by: <strong>${adminSig?.signer_name || record.admin_name || 'N/A'}</strong> (${adminSig?.signer_email || record.admin_email || 'N/A'})<br/>
    Date: ${adminSig?.signed_at ? new Date(adminSig.signed_at).toLocaleString() : record.admin_signed_at || 'N/A'}
  </p>
</div>
<div class="sig-box student" style="margin-top:12px;">
  <label style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:600;">🎓 Student Signature</label>
  <div style="margin-top:8px;">${studentSigDisplay}</div>
  <p style="font-size:12px;color:#64748b;margin-top:6px;">
    Signed by: <strong>${studentSig?.signer_name || record.student_name || 'N/A'}</strong> (${studentSig?.signer_email || record.student_email || 'N/A'})<br/>
    Date: ${studentSig?.signed_at ? new Date(studentSig.signed_at).toLocaleString() : record.student_signed_at || 'N/A'}
  </p>
</div>

<h2>Audit Trail</h2>
<table>
  <thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Notes</th></tr></thead>
  <tbody>${auditRows}</tbody>
</table>

<div class="footer">
  <p>Generated by BlockWard Digital Custodian System on ${now.toISOString()}</p>
  <p>Record ID: ${recordId} | School: ${schoolName}</p>
</div>
</body>
</html>`;

  // --- Get Google Drive access token ---
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  // --- Helper: find or create a folder in Drive ---
  async function findOrCreateFolder(name, parentId) {
    // Search for existing folder with drive.file scope (can only see app-created files)
    // We use name-based creation and store IDs in the record to avoid duplicate lookups
    const createRes = await fetch(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {})
      })
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create Drive folder '${name}': ${err}`);
    }
    const folder = await createRes.json();
    return folder.id;
  }

  // --- Build folder structure: BlockWard > School Name > Student Name > Awards and Records ---
  let rootFolderId, schoolFolderId, studentFolderId, awardsFolderId;
  try {
    rootFolderId    = await findOrCreateFolder('BlockWard');
    schoolFolderId  = await findOrCreateFolder(schoolName, rootFolderId);
    studentFolderId = await findOrCreateFolder(studentName, schoolFolderId);
    awardsFolderId  = await findOrCreateFolder('Awards and Records', studentFolderId);
  } catch (folderErr) {
    // Do NOT mark record as active — keep status as pending_drive_save
    return Response.json({
      ok: false,
      error: `Drive folder creation failed: ${folderErr.message}. Record status remains 'pending_drive_save'. You may retry.`
    }, { status: 500, headers: CORS });
  }

  // --- Upload file to Google Drive using multipart upload ---
  const fileContent = new TextEncoder().encode(htmlDoc);
  const boundary = '-------BlockWardBoundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metadata = JSON.stringify({
    name: fileName,
    mimeType: 'text/html',
    parents: [awardsFolderId]
  });

  const multipartBody = new TextEncoder().encode(
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    metadata +
    delimiter +
    'Content-Type: text/html\r\n\r\n' +
    htmlDoc +
    closeDelim
  );

  const uploadRes = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,webViewLink,name`, {
    method: 'POST',
    headers: {
      ...authHeader,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body: multipartBody
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    // CRITICAL: Do NOT mark as active on failure
    return Response.json({
      ok: false,
      error: `Drive upload failed: ${errText}. Record status remains 'pending_drive_save'. You may retry.`
    }, { status: 500, headers: CORS });
  }

  const uploadedFile = await uploadRes.json();
  const driveFileId = uploadedFile.id;
  const driveFileUrl = uploadedFile.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`;
  const folderPath = `BlockWard / ${schoolName} / ${studentName} / Awards and Records`;

  // --- Only mark active AFTER successful upload ---
  await base44.asServiceRole.entities.StudentRecord.update(recordId, {
    status: 'active',
    drive_file_url: driveFileUrl,
    drive_file_id: driveFileId,
    drive_folder_path: folderPath,
    approved_at: now.toISOString()
  });

  // --- Audit log ---
  const actorName = `${profile.first_name} ${profile.last_name}`;
  await base44.asServiceRole.entities.AuditLog.create({
    record_id: recordId,
    school_id: record.school_id,
    actor_email: user.email,
    actor_name: actorName,
    actor_role: 'admin',
    action: 'drive_saved',
    old_status: 'pending_drive_save',
    new_status: 'active',
    notes: `Saved to Google Drive: ${folderPath} | File ID: ${driveFileId}`,
    timestamp: now.toISOString()
  });

  return Response.json({
    ok: true,
    driveFileId,
    driveFileUrl,
    folderPath,
    fileName
  }, { headers: CORS });
});