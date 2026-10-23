import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// blocktalkAction — every BlockTalks mutation with a trust consequence runs
// here, server-side, so the client can never forge one:
//   publish        — holder shares their own verified achievement (badge is
//                    stamped from LIVE credential state, never client input)
//   publish_org    — a verified organisation requests to recognise a
//                    credential it issued; the holder must consent first
//   consent        — the holder approves/declines a pending recognition post
//   react          — celebrate / save toggles (other users' post rows)
//   delete_post    — author or admin only; never touches the achievement
//   report         — moderation report, service-role stored
//   block/unblock  — feed filtering blocks
// Reads stay on the client via RLS — this function only writes.

const MAX_CAPTION = 500;
const MAX_DETAILS = 500;

const bad = (msg, status = 400) => Response.json({ ok: false, error: msg }, { status });

function cleanText(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/\s+/g, ' ').trim().slice(0, max);
}

function nowIso() {
  return new Date().toISOString();
}

// Live verification check — the ONLY source of the Blockward Verified badge.
// Returns { verified, verification_status, credential } or an error string.
function checkCredentialLive(c) {
  if (!c) return { error: 'credential_not_found' };
  if (c.status !== 'active' || c.revocation) return { error: 'credential_revoked' };
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return { error: 'credential_expired' };
  if (c.is_public === false) return { error: 'achievement_private' };
  if (c.anchor_status !== 'confirmed') return { error: 'verification_pending' };
  return { verified: true, verification_status: 'confirmed', credential: c };
}

export default async function (req) {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return bad('Unauthorized', 401);
    const email = (user.email || '').trim().toLowerCase();

    const body = await req.json().catch(() => ({}));
    const action = cleanText(body.action, 40);
    const svc = base44.asServiceRole;

    // ── publish — a holder shares their own achievement ──
    if (action === 'publish') {
      const ref = cleanText(body.achievement_ref, 80);
      const title = cleanText(body.title, 200);
      if (!ref || !title) return bad('An achievement is required');
      const caption = cleanText(body.caption, MAX_CAPTION);
      const verificationId = cleanText(body.verification_id, 40) || null;

      let verified = false;
      let verificationStatus = 'unverified';
      if (verificationId) {
        // Ownership + live state, both checked server-side against the credential.
        const creds = await svc.entities.Credential.filter({ bw_id: verificationId });
        const check = checkCredentialLive(creds[0]);
        if (check.error === 'achievement_private') return bad(
          'This achievement\'s verification page is private. Change its visibility in My Achievements first.'
        );
        if (check.error) return bad('This achievement cannot be shared right now: ' + check.error);
        if ((check.credential.holder_email || '').trim().toLowerCase() !== email) {
          return bad('You can only share your own credentials', 403);
        }
        verified = check.verified;
        verificationStatus = check.verification_status;
      }

      const profiles = await svc.entities.UserProfile.filter({ user_email: email });
      const profile = profiles[0] || {};
      const displayName = cleanText(body.author_name, 80) ||
        `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || user.full_name || 'BlockWard member';

      const post = await svc.entities.BlockTalksPost.create({
        author_email: email,
        author_kind: 'individual',
        author_name: displayName,
        author_avatar_url: profile.avatar_url || null,
        author_handle: profile.handle || null,
        holder_email: null,
        achievement_ref: ref,
        achievement_title: title,
        achievement_category: cleanText(body.category, 60) || null,
        issuer_org: cleanText(body.issuer_org, 120) || null,
        banner_url: cleanText(body.banner_url, 600) || null,
        verification_id: verificationId,
        verified,
        verification_status: verificationStatus,
        caption: caption || null,
        status: 'active',
        published_at: nowIso(),
        celebrated_by: [],
        saved_by: [],
        report_count: 0,
      });
      return Response.json({ ok: true, post });
    }

    // ── publish_org — an organisation requests holder consent ──
    if (action === 'publish_org') {
      const orgId = cleanText(body.org_id, 60);
      const credentialId = cleanText(body.credential_id, 60);
      if (!orgId || !credentialId) return bad('An organisation and credential are required');
      const caption = cleanText(body.caption, MAX_CAPTION);

      const memberships = await svc.entities.OrganisationMember.filter({
        org_id: orgId, user_email: email, status: 'active',
      });
      if (!memberships.length) return bad('You are not an active member of this organisation', 403);

      const org = await svc.entities.IssuerOrganisation.get(orgId);
      if (!org || org.status !== 'verified') {
        return bad('Only Blockward-verified organisations can publish recognition posts');
      }

      const cred = await svc.entities.Credential.get(credentialId);
      if (!cred || cred.org_id !== orgId) return bad('This credential was not issued by this organisation', 403);
      const check = checkCredentialLive(cred);
      if (check.error === 'achievement_private') return bad('This credential\'s verification page is private.');
      if (check.error) return bad('This credential cannot be recognised right now: ' + check.error);

      // One live recognition post per credential — no duplicate pending requests.
      const existing = await svc.entities.BlockTalksPost.filter({ achievement_ref: `credential:${cred.id}` });
      if (existing.some((p) => p.status === 'active' || p.status === 'pending_holder_consent')) {
        return bad('A recognition post for this credential already exists');
      }

      const post = await svc.entities.BlockTalksPost.create({
        author_email: email,
        author_kind: 'organisation',
        author_name: org.name,
        author_avatar_url: org.logo_url || null,
        author_handle: null,
        org_id: orgId,
        org_name: org.name,
        org_handle: org.handle || null,
        holder_email: (cred.holder_email || '').trim().toLowerCase(),
        achievement_ref: `credential:${cred.id}`,
        achievement_title: cred.title,
        achievement_category: cred.category || null,
        issuer_org: org.name,
        banner_url: null,
        verification_id: cred.bw_id,
        verified: true,
        verification_status: 'confirmed',
        caption: caption || null,
        status: 'pending_holder_consent',
        published_at: null,
        celebrated_by: [],
        saved_by: [],
        report_count: 0,
      });
      return Response.json({ ok: true, post });
    }

    // ── consent — holder approves / declines a recognition post ──
    if (action === 'consent') {
      const postId = cleanText(body.post_id, 60);
      const approve = body.approve === true;
      const post = await svc.entities.BlockTalksPost.get(postId);
      if (!post || (post.holder_email || '').trim().toLowerCase() !== email) {
        return bad('Not found', 404);
      }
      if (post.status !== 'pending_holder_consent') return bad('This request is no longer pending');
      if (approve) {
        await svc.entities.BlockTalksPost.update(postId, { status: 'active', published_at: nowIso() });
      } else {
        await svc.entities.BlockTalksPost.delete(postId);
      }
      return Response.json({ ok: true });
    }

    // ── react — celebrate / save toggles on someone else's post ──
    if (action === 'react') {
      const postId = cleanText(body.post_id, 60);
      const type = cleanText(body.type, 20);
      if (!['celebrate', 'save'].includes(type)) return bad('Unknown reaction');
      const post = await svc.entities.BlockTalksPost.get(postId);
      if (!post || post.status !== 'active') return bad('Not found', 404);
      const field = type === 'celebrate' ? 'celebrated_by' : 'saved_by';
      const list = Array.isArray(post[field]) ? post[field] : [];
      const next = list.includes(email) ? list.filter((e) => e !== email) : [...list, email];
      await svc.entities.BlockTalksPost.update(postId, { [field]: next });
      return Response.json({ ok: true, active: next.includes(email), count: next.length });
    }

    // ── delete_post — author or admin; the achievement is never touched ──
    if (action === 'delete_post') {
      const postId = cleanText(body.post_id, 60);
      const post = await svc.entities.BlockTalksPost.get(postId);
      if (!post) return bad('Not found', 404);
      const isAuthor = (post.author_email || '').trim().toLowerCase() === email;
      if (!isAuthor && user.role !== 'admin') return bad('You can only remove your own posts', 403);
      await svc.entities.BlockTalksPost.delete(postId);
      return Response.json({ ok: true });
    }

    // ── report — moderation queue entry, stored service-side ──
    if (action === 'report') {
      const postId = cleanText(body.post_id, 60);
      const reason = cleanText(body.reason, 40);
      const allowed = ['spam', 'harassment', 'inappropriate', 'impersonation', 'misrepresented_verification', 'other'];
      if (!allowed.includes(reason)) return bad('Choose a report reason');
      const post = await svc.entities.BlockTalksPost.get(postId);
      if (!post) return bad('Not found', 404);
      const reports = await svc.entities.BlockTalksReport.filter({ post_id: postId, reporter_email: email });
      if (reports.length) return bad('You have already reported this post');
      await svc.entities.BlockTalksReport.create({
        post_id: postId,
        reporter_email: email,
        reason,
        details: cleanText(body.details, MAX_DETAILS) || null,
        status: 'open',
      });
      await svc.entities.BlockTalksPost.update(postId, { report_count: (post.report_count || 0) + 1 });
      return Response.json({ ok: true });
    }

    // ── block / unblock ──
    if (action === 'block' || action === 'unblock') {
      const blocked = cleanText(body.blocked_email, 200).toLowerCase();
      if (!blocked || blocked === email) return bad('Invalid user');
      const existing = await svc.entities.BlockTalksBlock.filter({ blocker_email: email, blocked_email: blocked });
      if (action === 'block') {
        if (!existing.length) {
          await svc.entities.BlockTalksBlock.create({
            blocker_email: email, blocked_email: blocked, blocked_at: nowIso(),
          });
        }
      } else {
        for (const b of existing) await svc.entities.BlockTalksBlock.delete(b.id);
      }
      return Response.json({ ok: true });
    }

    return bad('Unknown action');
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Request failed' }, { status: 500 });
  }
}