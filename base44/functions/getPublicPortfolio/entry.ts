/**
 * getPublicPortfolio — Public student portfolio endpoint.
 *
 * Anyone can view a student's public BlockWard achievements by student_id,
 * without logging in. Powers the /portfolio/:studentId shareable link.
 *
 * Privacy: returns ONLY achievements from BlockWardVerificationRegistry where
 * is_public === true and approval_status === 'approved'. Never returns the
 * student's email, private notes, or internal user IDs (student_id is the URL
 * key and is already exposed in the link).
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

  const student_id = body.student_id;
  if (!student_id) return Response.json({ ok: false, error: 'Missing student_id' }, { status: 400, headers: CORS });

  try {
    // 1. Resolve the student profile (service role — no auth required)
    let profile = null;
    try {
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ id: student_id });
      profile = profiles[0] || null;
    } catch (e) { /* ignore */ }

    if (!profile || profile.user_type !== 'student') {
      return Response.json({ ok: false, error: 'Portfolio not found' }, { status: 404, headers: CORS });
    }

    // 2. School / organisation info
    let school = null;
    if (profile.school_id) {
      try {
        const schools = await base44.asServiceRole.entities.School.filter({ id: profile.school_id });
        school = schools[0] || null;
      } catch (e) { /* ignore */ }
    }

    // 3. Public achievements from the permanent registry
    let registryRecords = [];
    try {
      registryRecords = await base44.asServiceRole.entities.BlockWardVerificationRegistry.filter({ student_id });
    } catch (e) { /* entity may be empty */ }

    const publicAchievements = registryRecords
      .filter(r => r.is_public === true && r.approval_status === 'approved')
      .sort((a, b) =>
        new Date(b.date_delivered || b.date_approved || b.date_achieved || b.updated_date) -
        new Date(a.date_delivered || a.date_approved || a.date_achieved || a.updated_date)
      )
      .map(r => ({
        verification_id: r.verification_id,
        title: r.achievement_title,
        description: r.achievement_description,
        category: r.achievement_category,
        image_url: r.achievement_image,
        date_achieved: r.date_achieved,
        date_approved: r.date_approved,
        date_delivered: r.date_delivered,
        teacher_name: r.teacher_name,
        admin_name: r.admin_name,
        organisation_name: r.organisation_name || school?.name || null,
        nft_status: r.nft_status,
        blockchain_network: r.blockchain_network,
        token_id: r.token_id,
        transaction_hash: r.transaction_hash,
        public_verification_url: r.public_verification_url,
      }));

    // Category breakdown for stats / chips
    const categoryCounts = {};
    publicAchievements.forEach(a => {
      categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
    });

    const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Student';

    return Response.json({
      ok: true,
      student: {
        name: fullName,
        avatar_url: profile.avatar_url || null,
        grade_level: profile.grade_level || null,
        student_id_number: profile.student_id || null,
      },
      school: school ? {
        name: school.name,
        org_type: school.org_type,
        city: school.city,
        country: school.country,
        logo_url: school.logo_url || null,
      } : null,
      achievements: publicAchievements,
      count: publicAchievements.length,
      categoryCounts,
    }, { headers: CORS });

  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
  }
});