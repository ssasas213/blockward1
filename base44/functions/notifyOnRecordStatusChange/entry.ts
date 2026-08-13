/**
 * notifyOnRecordStatusChange — triggered by entity automation on StudentRecord update.
 * Sends email notifications when a record needs attention:
 *   awaiting_teacher_signature → email the assigned teacher
 *   awaiting_admin_signature   → email all admins at the school
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const body = await req.json();
    const { data, old_data, event } = body;

    if (!data || !data.status) return Response.json({ ok: true, skipped: 'no status' });

    const newStatus = data.status;
    const oldStatus = old_data?.status;

    // Only act on meaningful status transitions
    if (newStatus === oldStatus) return Response.json({ ok: true, skipped: 'no change' });

    const appUrl = Deno.env.get('APP_URL') || 'https://blockward.me';
    const recordUrl = `${appUrl}/RecordDetail?id=${data.id || event?.entity_id}`;
    // Admin approval links use a dedicated, secure route that validates role + school
    const adminApprovalUrl = `${appUrl}/admin/approve/${data.id || event?.entity_id}`;

    // --- Teacher notification ---
    if (newStatus === 'awaiting_teacher_signature' && data.teacher_email) {
      try {
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
      } catch (e) { /* best-effort — don't crash the automation */ }
      return Response.json({ ok: true, notified: 'teacher', email: data.teacher_email });
    }

    // --- Admin notification ---
    if (newStatus === 'awaiting_admin_signature' && data.school_id) {
      try {
        const adminProfiles = await base44.asServiceRole.entities.UserProfile.filter({
          school_id: data.school_id,
          user_type: 'admin',
          status: 'active'
        });

        // Send to every admin in parallel, isolated with allSettled so a single bad
        // recipient (e.g. unregistered email) can never fail the whole batch.
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
<p>Sign in to BlockWard to approve and authorise the BlockWard:</p>
<p><a href="${adminApprovalUrl}" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Approve Achievement →</a></p>
<p style="color:#64748b;font-size:12px;">You received this as an admin at your school.</p>
            `.trim()
          })
        );

        await Promise.allSettled(notifications);
      } catch (e) { /* best-effort */ }
      return Response.json({ ok: true, notified: 'admins' });
    }

  // NOTE: Parent notification on delivery to vault is now handled by the
  // recordWorkflow sendToVault action itself, AFTER the verification registry
  // is created and all data is confirmed to exist. This prevents sending
  // emails with broken verification links.
  // The entity automation should NOT send parent emails for delivered_to_vault.

    // --- Student notification on rejection ---
    if (newStatus === 'rejected' && data.student_email) {
      const reason = data.rejection_reason || data.teacher_rejection_reason || 'Please contact your teacher for details.';
      try {
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
      } catch (e) { /* best-effort */ }
      return Response.json({ ok: true, notified: 'student_rejected', email: data.student_email });
    }

    return Response.json({ ok: true, skipped: `status ${newStatus} — no notification needed` });
  } catch (error) {
    return Response.json({ ok: false, error: error.message });
  }
});