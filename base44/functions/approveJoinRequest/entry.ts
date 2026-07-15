import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const adminProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    const adminProfile = adminProfiles[0];
    if (!adminProfile || adminProfile.user_type !== 'admin') {
      return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
    }
    const schoolId = adminProfile.school_id || adminProfile.active_school_id;
    if (!schoolId) {
      return Response.json({ error: 'No active school found' }, { status: 400 });
    }

    const body = await req.json();
    const { membership_id, membership_type, action, rejection_reason } = body;

    if (!membership_id || !membership_type || !action) {
      return Response.json({ error: 'membership_id, membership_type, and action are required' }, { status: 400 });
    }
    if (action !== 'approve' && action !== 'reject') {
      return Response.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
    }

    const adminName = `${adminProfile.first_name} ${adminProfile.last_name}`;
    const now = new Date().toISOString();

    if (membership_type === 'teacher') {
      // Fetch the StaffMembership
      const memberships = await base44.asServiceRole.entities.StaffMembership.filter({ id: membership_id });
      if (memberships.length === 0) {
        return Response.json({ error: 'Membership not found' }, { status: 404 });
      }
      const membership = memberships[0];

      // Verify it belongs to admin's school
      if (membership.school_id !== schoolId) {
        return Response.json({ error: 'Permission denied: membership belongs to a different school' }, { status: 403 });
      }

      if (membership.status !== 'pending') {
        return Response.json({ error: `Membership is already ${membership.status}` }, { status: 400 });
      }

      if (action === 'approve') {
        // Update membership to active
        await base44.asServiceRole.entities.StaffMembership.update(membership.id, {
          status: 'active',
          reviewed_by: user.email,
          reviewed_at: now,
        });

        // Update the teacher's profile to link to this school
        const teacherProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: membership.user_email });
        if (teacherProfiles.length > 0) {
          const tp = teacherProfiles[0];
          await base44.asServiceRole.entities.UserProfile.update(tp.id, {
            school_id: membership.school_id,
            active_school_id: membership.school_id,
            user_type: 'teacher',
            status: 'active',
            admin_email: user.email,
          });
        }

        // Create notification for the teacher
        try {
          await base44.asServiceRole.entities.Notification.create({
            user_email: membership.user_email,
            school_id: membership.school_id,
            title: 'Teacher Access Approved',
            body: `Your request to join ${membership.school_name} has been approved. You can now access the Teacher Dashboard.`,
            type: 'announcement_important',
            priority: 'important',
            related_id: membership.id,
            read: false,
          });
        } catch (e) {
          console.error('Failed to create notification:', e);
        }

        // Create audit log
        await base44.asServiceRole.entities.AuditLog.create({
          record_id: membership.id,
          school_id: membership.school_id,
          actor_email: user.email,
          actor_name: adminName,
          actor_role: 'admin',
          action: 'teacher_approved',
          old_status: 'pending',
          new_status: 'active',
          notes: `Teacher ${membership.teacher_name || membership.user_email} approved by ${user.email}`,
          timestamp: now,
        });

        return Response.json({
          success: true,
          action: 'approved',
          teacher_name: membership.teacher_name,
          teacher_email: membership.user_email,
        });

      } else {
        // Reject
        await base44.asServiceRole.entities.StaffMembership.update(membership.id, {
          status: 'rejected',
          reviewed_by: user.email,
          reviewed_at: now,
          rejection_reason: rejection_reason || 'Not specified',
        });

        try {
          await base44.asServiceRole.entities.Notification.create({
            user_email: membership.user_email,
            school_id: membership.school_id,
            title: 'Teacher Access Update',
            body: `Your request to join ${membership.school_name} was not approved at this time. Reason: ${rejection_reason || 'Not specified'}`,
            type: 'announcement_important',
            priority: 'important',
            related_id: membership.id,
            read: false,
          });
        } catch (e) {
          console.error('Failed to create notification:', e);
        }

        await base44.asServiceRole.entities.AuditLog.create({
          record_id: membership.id,
          school_id: membership.school_id,
          actor_email: user.email,
          actor_name: adminName,
          actor_role: 'admin',
          action: 'teacher_rejected',
          old_status: 'pending',
          new_status: 'rejected',
          notes: `Teacher ${membership.teacher_name || membership.user_email} rejected by ${user.email}`,
          timestamp: now,
        });

        return Response.json({
          success: true,
          action: 'rejected',
          teacher_name: membership.teacher_name,
          teacher_email: membership.user_email,
        });
      }

    } else if (membership_type === 'admin') {
      // Fetch the AdminSchoolMembership
      const memberships = await base44.asServiceRole.entities.AdminSchoolMembership.filter({ id: membership_id });
      if (memberships.length === 0) {
        return Response.json({ error: 'Membership not found' }, { status: 404 });
      }
      const membership = memberships[0];

      if (membership.school_id !== schoolId) {
        return Response.json({ error: 'Permission denied: membership belongs to a different school' }, { status: 403 });
      }

      if (membership.status !== 'pending') {
        return Response.json({ error: `Membership is already ${membership.status}` }, { status: 400 });
      }

      // Only the school owner or super_admin can approve admin requests
      const ownerMemberships = await base44.asServiceRole.entities.AdminSchoolMembership.filter({
        school_id: schoolId,
        admin_email: user.email,
        role: 'owner'
      });
      if (ownerMemberships.length === 0 && adminProfile.admin_level !== 'super_admin') {
        return Response.json({ error: 'Only the school owner can approve admin join requests' }, { status: 403 });
      }

      if (action === 'approve') {
        await base44.asServiceRole.entities.AdminSchoolMembership.update(membership.id, {
          status: 'active',
          reviewed_by: user.email,
          reviewed_at: now,
        });

        // Update the admin's profile
        const adminUserProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: membership.admin_email });
        if (adminUserProfiles.length > 0) {
          const ap = adminUserProfiles[0];
          await base44.asServiceRole.entities.UserProfile.update(ap.id, {
            school_id: membership.school_id,
            active_school_id: membership.school_id,
            user_type: 'admin',
            status: 'active',
          });
        }

        try {
          await base44.asServiceRole.entities.Notification.create({
            user_email: membership.admin_email,
            school_id: membership.school_id,
            title: 'Admin Access Approved',
            body: `Your request to join ${membership.school_name} as an administrator has been approved.`,
            type: 'announcement_important',
            priority: 'important',
            related_id: membership.id,
            read: false,
          });
        } catch (e) {
          console.error('Failed to create notification:', e);
        }

        await base44.asServiceRole.entities.AuditLog.create({
          record_id: membership.id,
          school_id: membership.school_id,
          actor_email: user.email,
          actor_name: adminName,
          actor_role: 'admin',
          action: 'teacher_approved',
          old_status: 'pending',
          new_status: 'active',
          notes: `Admin ${membership.admin_name || membership.admin_email} approved by ${user.email}`,
          timestamp: now,
        });

        return Response.json({
          success: true,
          action: 'approved',
          admin_name: membership.admin_name,
          admin_email: membership.admin_email,
        });

      } else {
        await base44.asServiceRole.entities.AdminSchoolMembership.update(membership.id, {
          status: 'rejected',
          reviewed_by: user.email,
          reviewed_at: now,
        });

        try {
          await base44.asServiceRole.entities.Notification.create({
            user_email: membership.admin_email,
            school_id: membership.school_id,
            title: 'Admin Access Update',
            body: `Your request to join ${membership.school_name} was not approved at this time.`,
            type: 'announcement_important',
            priority: 'important',
            related_id: membership.id,
            read: false,
          });
        } catch (e) {
          console.error('Failed to create notification:', e);
        }

        await base44.asServiceRole.entities.AuditLog.create({
          record_id: membership.id,
          school_id: membership.school_id,
          actor_email: user.email,
          actor_name: adminName,
          actor_role: 'admin',
          action: 'teacher_rejected',
          old_status: 'pending',
          new_status: 'rejected',
          notes: `Admin ${membership.admin_name || membership.admin_email} rejected by ${user.email}`,
          timestamp: now,
        });

        return Response.json({
          success: true,
          action: 'rejected',
          admin_name: membership.admin_name,
          admin_email: membership.admin_email,
        });
      }

    } else {
      return Response.json({ error: 'membership_type must be "teacher" or "admin"' }, { status: 400 });
    }

  } catch (error) {
    console.error('approveJoinRequest error:', error);
    return Response.json({ error: error.message || 'Failed to process request' }, { status: 500 });
  }
});