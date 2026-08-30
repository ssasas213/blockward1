/**
 * notifyOnRecordStatusChange — the SINGLE canonical record-status notification
 * dispatcher. Triggered by ONE entity automation on StudentRecord update, gated to
 * status changes only (changed_fields contains 'status').
 *
 * It inspects old_status + new_status + record + school and determines the correct
 * notification recipient(s), message, and deep link — sending both email and an
 * in-app Notification. Duplicate prevention is enforced via `last_notified_status`
 * on the record: a transition is only dispatched once even if the automation
 * retries. Email batches use Promise.allSettled so one invalid recipient cannot
 * fail the whole operation.
 *
 * Transition → recipient map:
 *   submitted / awaiting_teacher_signature → assigned teacher  (deep link: record review)
 *   awaiting_admin_signature               → all school admins   (deep link: admin approval)
 *   changes_requested                       → teacher + student   (deep link: record review w/ feedback)
 *   approved                                → teacher (closure)  (deep link: record review)
 *   delivered_to_vault                      → student             (deep link: delivered BlockWard)
 *   rejected                                → student             (deep link: record review)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendResendEmail } from '../../shared/resendEmail.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'content-type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const base44 = createClientFromRequest(req);

  try {
    const body = await req.json();
    const data = body?.data;
    if (!data || !data.status) return Response.json({ ok: true, skipped: 'no status' });

    const newStatus = data.status;
    const oldStatus = body?.old_data?.status;

    // Only act on actual status transitions — never on unrelated field updates.
    if (newStatus === oldStatus) return Response.json({ ok: true, skipped: 'no status change' });

    // 'delivering' is a transient concurrency-lock status during vault delivery.
    // It is never user-facing and must not notify, nor set the idempotency marker
    // (so the subsequent delivered_to_vault transition still dispatches correctly).
    if (newStatus === 'delivering') return Response.json({ ok: true, skipped: 'transient delivering lock' });

    // Idempotency: a transition is dispatched at most once, even on retries.
    if (data.last_notified_status === newStatus) {
      return Response.json({ ok: true, skipped: 'already notified for this status' });
    }

    const recordId = data.id || (body?.event && body.event.entity_id) || '';
    const appUrl = Deno.env.get('APP_URL') || 'https://blockward.me';
    const recordUrl = appUrl + '/RecordDetail?id=' + recordId;
    const adminApprovalUrl = appUrl + '/admin/approve/' + recordId;
    const schoolId = data.school_id || '';

    const sendEmail = async (to, subject, html) => {
      const { delivered, error } = await sendResendEmail(to, subject, html);
      if (!delivered) console.log('[notify] email not delivered', { to, error });
    };

    const notifyInApp = async (userEmail, title, bodyText, priority) => {
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_email: userEmail,
          school_id: schoolId,
          title: title,
          body: bodyText,
          type: priority === 'urgent' ? 'announcement_urgent' : 'announcement_important',
          priority: priority || 'important',
          related_id: recordId,
          read: false,
        });
      } catch (e) { /* best-effort */ }
    };

    const title = data.title || 'Achievement';
    const studentName = data.student_name || 'Student';
    const studentEmail = data.student_email || '';
    const teacherName = data.teacher_name || 'Teacher';
    const teacherEmail = data.teacher_email || '';
    const category = data.category || '';

    // ── submitted / awaiting_teacher_signature → notify the assigned teacher ──
    if (newStatus === 'awaiting_teacher_signature' && teacherEmail) {
      const isResubmit = oldStatus === 'changes_requested';
      const subject = isResubmit
        ? ('Re-review required: "' + title + '" was resubmitted')
        : ('Action required: Please review "' + title + '"');
      const intro = isResubmit
        ? 'An achievement has been edited and resubmitted after changes were requested.'
        : 'A student achievement record requires your review and signature:';
      const html = '<p>Hi ' + teacherName + ',</p><p>' + intro + '</p>' +
        '<ul><li><strong>Title:</strong> ' + title + '</li>' +
        '<li><strong>Student:</strong> ' + studentName + ' (' + studentEmail + ')</li>' +
        '<li><strong>Category:</strong> ' + category + '</li></ul>' +
        '<p><a href="' + recordUrl + '" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Review &amp; Sign</a></p>';
      await sendEmail(teacherEmail, subject, html);
      const inAppTitle = isResubmit ? 'Resubmitted achievement needs your signature' : 'New achievement needs your signature';
      const inAppBody = '"' + title + '" — ' + (isResubmit ? 'resubmitted after changes' : 'submitted by ' + studentName) + '.';
      await notifyInApp(teacherEmail, inAppTitle, inAppBody, 'important');
    }

    // ── awaiting_admin_signature → notify all school admins ──
    else if (newStatus === 'awaiting_admin_signature' && schoolId) {
      let adminProfiles = [];
      try {
        adminProfiles = await base44.asServiceRole.entities.UserProfile.filter({
          school_id: schoolId, user_type: 'admin', status: 'active'
        });
      } catch (e) { /* best-effort */ }

      const subject = 'Approval needed: "' + title + '" has been teacher-endorsed';
      const html = '<p>Hi {name},</p><p>A student achievement has been reviewed and signed by the teacher. It now requires your final approval:</p>' +
        '<ul><li><strong>Title:</strong> ' + title + '</li>' +
        '<li><strong>Student:</strong> ' + studentName + ' (' + studentEmail + ')</li>' +
        '<li><strong>Teacher:</strong> ' + teacherName + '</li>' +
        '<li><strong>Category:</strong> ' + category + '</li></ul>' +
        '<p><a href="' + adminApprovalUrl + '" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Approve Achievement</a></p>';

      await Promise.allSettled(adminProfiles.map(admin =>
        sendEmail(admin.user_email, subject, html.replace('{name}', admin.first_name || 'Admin'))
      ));
      await Promise.allSettled(adminProfiles.map(admin =>
        notifyInApp(admin.user_email, 'Achievement awaiting your approval', '"' + title + '" — endorsed by ' + teacherName + ', ready for final approval.', 'important')
      ));
    }

    // ── changes_requested → notify teacher + student (feedback visible at record) ──
    else if (newStatus === 'changes_requested') {
      const reason = data.changes_requested_reason || 'Please review the requested changes.';
      const byName = data.changes_requested_by_name || 'Admin';
      const box = '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0;">' +
        '<p style="margin:0;"><strong>Requested by:</strong> ' + byName + '</p>' +
        '<p style="margin:8px 0 0;"><strong>Feedback:</strong> ' + reason + '</p></div>';

      if (studentEmail) {
        const subject = 'Changes requested on "' + title + '"';
        const html = '<p>Hi ' + studentName + ',</p><p>An administrator has requested changes to your achievement before it can be approved.</p>' + box +
          '<p>Please edit and resubmit the achievement:</p>' +
          '<p><a href="' + recordUrl + '" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View Feedback &amp; Edit</a></p>';
        await sendEmail(studentEmail, subject, html);
        await notifyInApp(studentEmail, 'Changes requested on your achievement', '"' + title + '" — ' + reason, 'urgent');
      }
      if (teacherEmail) {
        const subject = 'Changes requested on "' + title + '"';
        const html = '<p>Hi ' + teacherName + ',</p><p>An administrator has requested changes to an achievement you endorsed.</p>' + box +
          '<p><a href="' + recordUrl + '" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View &amp; Edit</a></p>';
        await sendEmail(teacherEmail, subject, html);
        await notifyInApp(teacherEmail, 'Changes requested on endorsed achievement', '"' + title + '" — ' + reason, 'urgent');
      }
    }

    // ── approved → notify teacher (closure) ──
    else if (newStatus === 'approved' && teacherEmail) {
      const subject = 'Approved: "' + title + '" — pending vault delivery';
      const html = '<p>Hi ' + teacherName + ',</p><p>Your endorsement of "' + title + '" has been approved by the administrator. It will be delivered to the student vault shortly.</p>' +
        '<p><a href="' + recordUrl + '" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View Record</a></p>';
      await sendEmail(teacherEmail, subject, html);
      await notifyInApp(teacherEmail, 'Achievement you endorsed was approved', '"' + title + '" — approved by admin, pending vault delivery.', 'important');
    }

    // ── delivered_to_vault → notify student (the one BlockWard) ──
    else if (newStatus === 'delivered_to_vault' && studentEmail) {
      const subject = 'New BlockWard in your Vault: "' + title + '"';
      const html = '<p>Hi ' + studentName + ',</p><p>A verified achievement has been added to your BlockWard Vault.</p>' +
        '<ul><li><strong>Title:</strong> ' + title + '</li><li><strong>Category:</strong> ' + category + '</li></ul>' +
        '<p><a href="' + recordUrl + '" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View BlockWard</a></p>';
      await sendEmail(studentEmail, subject, html);
      await notifyInApp(studentEmail, 'New BlockWard in your Vault!', '"' + title + '" has been delivered to your vault.', 'important');
    }

    // ── rejected → notify student ──
    else if (newStatus === 'rejected' && studentEmail) {
      const reason = data.rejection_reason || data.teacher_rejection_reason || 'Please contact your teacher for details.';
      const subject = 'Update on your achievement: "' + title + '"';
      const html = '<p>Hi ' + studentName + ',</p><p>Your achievement <strong>"' + title + '"</strong> was not approved at this time.</p>' +
        '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;"><p style="margin:0;color:#dc2626;"><strong>Reason:</strong> ' + reason + '</p></div>' +
        '<p><a href="' + recordUrl + '" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View Record</a></p>';
      await sendEmail(studentEmail, subject, html);
      await notifyInApp(studentEmail, 'Achievement not approved', '"' + title + '" — ' + reason, 'important');
    }

    // ── Mark this status as dispatched (idempotency marker) ──
    // Updating only last_notified_status does NOT change `status`, so this does not
    // re-trigger the status-change automation.
    try {
      await base44.asServiceRole.entities.StudentRecord.update(recordId, {
        last_notified_status: newStatus
      });
    } catch (e) { /* best-effort — notifications already sent */ }

    return Response.json({ ok: true, dispatched: newStatus }, { headers: CORS });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
  }
});