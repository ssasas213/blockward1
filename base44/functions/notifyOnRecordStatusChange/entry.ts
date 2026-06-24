/**
 * notifyOnRecordStatusChange — triggered by entity automation on StudentRecord update.
 * Sends email notifications when a record needs attention:
 *   awaiting_teacher_signature → email the assigned teacher
 *   awaiting_admin_signature   → email all admins at the school
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const { data, old_data, event } = body;

  if (!data || !data.status) return Response.json({ ok: true, skipped: 'no status' });

  const newStatus = data.status;
  const oldStatus = old_data?.status;

  // Only act on meaningful status transitions
  if (newStatus === oldStatus) return Response.json({ ok: true, skipped: 'no change' });

  const appUrl = Deno.env.get('APP_URL') || 'https://blockward.app';
  const recordUrl = `${appUrl}/RecordDetail?id=${data.id || event?.entity_id}`;

  // --- Teacher notification ---
  if (newStatus === 'awaiting_teacher_signature' && data.teacher_email) {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: data.teacher_email,
      subject: `Action required: Please review "${data.title}"`,
      body: `
<p>Hi ${data.teacher_name || 'Teacher'},</p>
<p>A student achievement record requires your review and signature:</p>
<ul>
  <li><strong>Title:</strong> ${data.title}</li>
  <li><strong>Student:</strong> ${data.student_name} (${data.student_email})</li>
  <li><strong>Category:</strong> ${data.category}</li>
</ul>
<p>Please sign in to BlockWard to review and endorse this record:</p>
<p><a href="${recordUrl}" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Review Achievement →</a></p>
<p style="color:#64748b;font-size:12px;">You received this because you are the assigned teacher for this class.</p>
      `.trim()
    });
    return Response.json({ ok: true, notified: 'teacher', email: data.teacher_email });
  }

  // --- Admin notification ---
  if (newStatus === 'awaiting_admin_signature' && data.school_id) {
    const adminProfiles = await base44.asServiceRole.entities.UserProfile.filter({
      school_id: data.school_id,
      user_type: 'admin',
      status: 'active'
    });

    const notifications = adminProfiles.map(admin =>
      base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.user_email,
        subject: `Approval needed: "${data.title}" has been teacher-endorsed`,
        body: `
<p>Hi ${admin.first_name || 'Admin'},</p>
<p>A student achievement has been reviewed and signed by the teacher. It now requires your final approval:</p>
<ul>
  <li><strong>Title:</strong> ${data.title}</li>
  <li><strong>Student:</strong> ${data.student_name} (${data.student_email})</li>
  <li><strong>Teacher:</strong> ${data.teacher_name}</li>
  <li><strong>Category:</strong> ${data.category}</li>
</ul>
<p>Sign in to BlockWard to approve and authorise NFT minting:</p>
<p><a href="${recordUrl}" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Approve Achievement →</a></p>
<p style="color:#64748b;font-size:12px;">You received this as an admin at your school.</p>
        `.trim()
      })
    );

    await Promise.all(notifications);
    return Response.json({ ok: true, notified: 'admins', count: adminProfiles.length });
  }

  // --- Parent notification on delivery to student vault (verified + delivered) ---
  if ((newStatus === 'delivered_to_vault' || newStatus === 'archived') && data.student_email) {
    // Fetch the student's profile to get parent contact
    const studentProfiles = await base44.asServiceRole.entities.UserProfile.filter({
      user_email: data.student_email
    });
    const studentProfile = studentProfiles[0];

    if (studentProfile?.parent_email) {
      const appUrl = Deno.env.get('APP_URL') || 'https://blockward.app';
      const verifyUrl = data.verify_id
        ? `${appUrl}/Verify?id=${data.verify_id}`
        : recordUrl;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: studentProfile.parent_email,
        subject: `🎓 ${data.student_name || 'Your child'} has received a verified achievement certificate`,
        body: `
<p>Dear ${studentProfile.parent_name || 'Parent/Guardian'},</p>
<p>We are pleased to inform you that <strong>${data.student_name || 'your child'}</strong> has received a verified digital achievement certificate from ${data.teacher_name ? `${data.teacher_name} and the admin team` : 'the school'}.</p>
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;">
  <h3 style="color:#5b21b6;margin:0 0 12px;">${data.title}</h3>
  ${data.description ? `<p style="color:#475569;margin:0 0 8px;">${data.description}</p>` : ''}
  <p style="color:#64748b;font-size:13px;margin:0;"><strong>Category:</strong> ${data.category || 'Achievement'}</p>
  ${data.date_achieved ? `<p style="color:#64748b;font-size:13px;margin:4px 0 0;"><strong>Date:</strong> ${data.date_achieved}</p>` : ''}
  ${data.verify_id ? `<p style="color:#64748b;font-size:13px;margin:4px 0 0;"><strong>Verification ID:</strong> ${data.verify_id}</p>` : ''}
</div>
<p>This achievement has been reviewed and digitally signed by both the teacher and school administration. It is permanently archived and can be verified at any time.</p>
<p>
  <a href="${verifyUrl}" style="background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">
    View & Verify Certificate →
  </a>
</p>
${data.drive_file_url ? `<p><a href="${data.drive_file_url}" style="color:#7c3aed;">View Certificate in Google Drive</a></p>` : ''}
<p style="color:#94a3b8;font-size:12px;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;">
  This certificate was issued by BlockWard — the school's digital custodian platform for verified student achievements.
</p>
        `.trim()
      });
      return Response.json({ ok: true, notified: 'parent', email: studentProfile.parent_email });
    }
  }

  // --- Student notification on rejection ---
  if (newStatus === 'rejected' && data.student_email) {
    const reason = data.rejection_reason || data.teacher_rejection_reason || 'Please contact your teacher for details.';
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: data.student_email,
      subject: `Update on your achievement submission: "${data.title}"`,
      body: `
<p>Hi ${data.student_name || 'there'},</p>
<p>Your achievement submission <strong>"${data.title}"</strong> has been reviewed and was not approved at this time.</p>
<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
  <p style="color:#dc2626;margin:0;"><strong>Reason:</strong> ${reason}</p>
</div>
<p>You may resubmit with updated evidence or contact your teacher for guidance.</p>
<p><a href="${recordUrl}" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View Record →</a></p>
      `.trim()
    });
    return Response.json({ ok: true, notified: 'student_rejected', email: data.student_email });
  }

  return Response.json({ ok: true, skipped: `status ${newStatus} — no notification needed` });
});