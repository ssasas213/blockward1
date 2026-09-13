// ============================================================================
// seedInvestorDemo — one-action seeding of a COMPLETE, coherent demo world for
// investor-deck screenshots, and one-action removal of everything it created.
//
// PRESERVATION CONTRACT — every credential is produced through the REAL code
// paths, never by writing flow entities directly:
//   - accounts: provisionProfile (role derived server-side from join codes)
//   - organisations: createSchoolForAdmin (the setupSchool path)
//   - teacher approval: staffApprovals.reviewStaffMembership (the real engine)
//   - achievement requests: shared/achievementRequestFlow (the SAME module the
//     achievementRequestAction endpoint dispatches through)
//   - independent verification: the student submits → the account-free
//     verifier link is generated → external_confirm runs through the same
//     token-authenticated code the /external-verify page drives
//   - delivery/publishing: credentialDelivery.mintRequestCredential
//   - endorsements: shared/endorsements.endorseAchievement (same rules:
//     scarcity budget, no self/trading, eligibility, caps)
//   - one credential is genuinely minted on the app's real Sepolia contract
//     (the same issueAward call issueBlockwardV2 uses) so the public
//     verification page shows a real blockchain record.
//
// The seeder is idempotent/resumable: every step checks for its own output
// first, so re-running after a timeout continues where it left off.
//
// DEMO MARKING: every seeded account lives on the reserved @demo.blockward.test
// domain, and the DemoSeedRun record (kind 'investor_world') carries the full
// manifest — every organisation id and every seeded email. `action: 'remove'`
// purges all school-scoped entities plus every school-less record (independently
// verified credentials, self-reported achievements) by those emails, then the
// profiles and organisations themselves. One action, the whole world is gone.
//
// Authorization: the Test Super User, or a real super_admin. Also runnable
// from the Base44 console.
//
// Actions: 'seed' | 'remove' | 'status'
// ============================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createPublicClient, createWalletClient, http, parseAbi, getAddress } from 'npm:viem@2.7.0';
import { encodeBytes32String } from 'npm:ethers@6.13.0';
import { privateKeyToAccount } from 'npm:viem@2.7.0/accounts';
import { sepolia } from 'npm:viem@2.7.0/chains';
import { verifyTestSuperUser } from '../../shared/testMode.ts';
import { provisionProfile } from '../../shared/profileProvisioning.ts';
import { createSchoolForAdmin } from '../../shared/schoolSetup.ts';
import { reviewStaffMembership } from '../../shared/staffApprovals.ts';
import { isHandleAvailable } from '../../shared/handles.ts';
import { endorseAchievement, buildAffiliation } from '../../shared/endorsements.ts';
import { submitRequest, runReviewerAction, runExternalAction, retryMint } from '../../shared/achievementRequestFlow.ts';

const D = 'demo.blockward.test';
const IMG = 'https://media.base44.com/images/public/6936b840baa53bb465f68d09';
const appUrl = () => Deno.env.get('APP_URL') || 'https://blockward.base44.app';
const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();
const day = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
const fail = (msg) => { throw new Error(msg); };

// ── The demo world cast (all clearly fictional, all on the demo domain) ──
const SCHOOL_NAME = 'Northgate Grammar School';
const CLUB_NAME = 'Meridian Athletics Club';
const HERO = { email: `maya.ellison@${D}`, first: 'Maya', last: 'Ellison', dob: '2009-04-18', handle: 'maya_ellison' };
const TEACHER = { email: `daniel.okafor@${D}`, first: 'Daniel', last: 'Okafor', dob: '1987-09-02' };
const SCHOOL_ADMIN = { email: `priya.raghavan@${D}`, first: 'Priya', last: 'Raghavan' };
const CLUB_ADMIN = { email: `marcus.bell@${D}`, first: 'Marcus', last: 'Bell' };
const KARATE_VERIFIER = { email: `kenji.mori@${D}`, name: 'Kenji Mori', role: 'instructor', org: 'Lotus Martial Arts Academy' };
const CHESS_VERIFIER = { email: `elena.novak@${D}`, name: 'Elena Novak', role: 'referee', org: 'Centurion Chess Club' };

const CLASSMATES = [
  ['Amara', 'Osei'], ['Theo', 'Lindqvist'], ['Zara', 'Haddad'], ['Finlay', 'Doyle'],
  ['Imani', 'Walker'], ['Rafael', 'Costa'], ['Noor', 'Rahman'], ['Jasper', 'Wu'],
  ['Leila', 'Farouk'], ['Oscar', 'Novak'], ['Aisha', 'Bello'], ['Callum', 'Ferguson'],
  ['Priya', 'Menon'], ['Yusuf', 'Demir'], ['Elena', 'Petrova'], ['Sam', 'Whitfield'],
  ['Tumi', 'Molefe'], ['Hannah', 'Levi'], ['Diego', 'Salas'], ['Freya', 'Lindgren'],
  ['Ishaan', 'Kapoor'], ['Lily', 'Fontaine'], ['Mateo', 'Reyes'],
];

const IMAGES = {
  avatar: `${IMG}/8203ffe46_generated_image.png`,
  banner: `${IMG}/19d9426f1_generated_image.png`,
  school_logo: `${IMG}/73df60d13_generated_image.png`,
  club_logo: `${IMG}/443a82602_generated_image.png`,
  county: `${IMG}/45f6dc10b_generated_image.png`,
  regional: `${IMG}/cb152c1dc_generated_image.png`,
  karate: `${IMG}/47e0fbdbc_generated_image.png`,
  violin: `${IMG}/d78170a1e_generated_image.png`,
  chess: `${IMG}/087249666_generated_image.png`,
  mathprize: `${IMG}/64c96b7a3_generated_image.png`,
  science: `${IMG}/ddbf4de4e_generated_image.png`,
  leadership: `${IMG}/e09f85459_generated_image.png`,
  volunteering: `${IMG}/29d9fc74e_generated_image.png`,
  selfreport: `${IMG}/b759e88d9_generated_image.png`,
};

// ── The hero's 10 achievements: 6 organisation-verified (school + club), 2
// independently verified, 1 pending review, 1 unverified self-reported ──
const ACHIEVEMENTS = [
  {
    key: 'county_final', org: 'club', tier: 1,
    title: 'County Athletics Championships — 2nd Place, 200m',
    label: 'County Championship Final', category: 'sports',
    date: '2026-06-13', backdate: 9, cover: IMAGES.county,
    description: 'Silver medallist in the 200m final at the county championships, setting a new under-18 club record of 25.8s.',
  },
  {
    key: 'regional_track', org: 'club', tier: 1,
    title: 'Regional Track & Field Meeting — 3rd Place, 400m',
    label: 'Regional Track & Field Meeting', category: 'sports',
    date: '2026-05-16', backdate: 11, cover: IMAGES.regional,
    description: 'Bronze in the 400m at the regional schools meeting, breaking 59 seconds for the first time.',
  },
  {
    key: 'math_prize', org: 'school', tier: 1,
    title: 'Northgate Mathematics Prize — Year 12',
    label: 'Subject Prize', category: 'academic',
    date: '2026-07-03', backdate: 16, cover: IMAGES.mathprize,
    description: 'Awarded the Year 12 Mathematics Prize for the highest sustained performance across the year, including a perfect score in the challenge round.',
  },
  {
    key: 'science_olympiad', org: 'school', tier: 1,
    title: 'National Junior Science Olympiad — Bronze Certificate',
    label: 'Competition Placing', category: 'academic',
    date: '2026-03-21', backdate: 14, cover: IMAGES.science,
    description: 'Bronze certificate at the National Junior Science Olympiad, finishing in the top 12% of entrants nationwide.',
  },
  {
    key: 'violin', org: 'school', tier: 1,
    title: 'Grade 8 Violin with Distinction',
    label: 'Music Examination', category: 'arts',
    date: '2026-06-27', backdate: 12, cover: IMAGES.violin,
    description: 'Passed the Grade 8 violin examination with distinction — 142/150, the highest mark in the school’s music department this year.',
  },
  {
    key: 'leadership', org: 'school', tier: 2,
    title: 'Head Girl — Student Leadership Team 2026/27',
    label: 'Leadership Role', category: 'leadership',
    date: '2026-09-01', backdate: 10, cover: IMAGES.leadership,
    description: 'Elected Head Girl after a whole-school vote; leads the Student Leadership Team and the Year 12 mentoring scheme.',
  },
  {
    key: 'volunteering', org: 'school', tier: 1, pending: true,
    title: 'Community Service Award — 200 Volunteer Hours',
    label: 'Volunteering Programme', category: 'community',
    date: '2026-08-30', backdate: 2, cover: IMAGES.volunteering,
    description: 'Completed 200 verified volunteer hours with the Northgate community programme, leading the weekend food-bank rota.',
  },
  {
    key: 'karate', independent: true,
    title: 'Karate — Shodan Black Belt',
    category: 'sports',
    date: '2026-04-11', backdate: 20, cover: IMAGES.karate,
    description: 'Awarded shodan (first-degree black belt) after a full grading covering kihon, kata and kumite.',
    verifier: KARATE_VERIFIER,
    relationship: 'My sensei for six years at the Lotus dojo',
  },
  {
    key: 'chess', independent: true,
    title: 'Chess — 1850 National Junior Rating',
    category: 'special',
    date: '2026-02-14', backdate: 13, cover: IMAGES.chess,
    description: 'Reached a 1850 national junior rating after three rated tournaments, finishing joint-second at the Centurion Junior Congress.',
    verifier: CHESS_VERIFIER,
    relationship: 'Tournament arbiter at three of my rated events',
  },
];

const SELF_REPORTED = {
  title: 'Built a study-planner web app used by 300+ students',
  domain: 'professional',
  date: '2026-08-15',
  cover: IMAGES.selfreport,
  description: 'Designed and shipped a study-planner app adopted by over 300 students across three year groups. Wrote the frontend and the timetabling engine myself.',
};

const ENDORSEMENTS = [
  { key: 'county_final', from: 0, text: 'I ran the 200m heats against Maya at counties — she is the most composed athlete on the track.' },
  { key: 'regional_track', from: 3, text: 'Maya trained with our sprint group every Thursday morning. Her 400m splits dropped all season and the podium was earned.' },
  { key: 'math_prize', from: 1, text: 'She tutored half of our set before the mock exams and still topped the year. The prize was thoroughly earned.' },
  { key: 'leadership', from: 2, text: 'As head girl Maya runs the Year 12 mentoring scheme and personally onboarded every new student this term.' },
  { key: 'chess', from: 9, text: 'Watched her close out the junior quals at Centurion — her endgame calculation is scary good for our age group.' },
];

// ── Removal: everything school-scoped purges by organisation; the rest
// (school-less independent credentials, self-reported achievements,
// notifications) purges by the seeded emails. ──
const PURGE_BY_SCHOOL = [
  'SchoolCode', 'AdminSchoolMembership', 'StaffMembership', 'Enrollment', 'Class',
  'TimetableEntry', 'AttendanceSession', 'AttendanceRecord', 'AttendanceAuditLog',
  'Assessment', 'StudentGrade', 'SeatingPlan', 'EndorsementTerm', 'EndorsementInvite',
  'Announcement', 'AnnouncementReadReceipt', 'AuditLog', 'Notification',
  'AchievementRequest', 'StudentRecord', 'BlockWard', 'BlockWardVerificationRegistry',
  'JoinRequest', 'Resource', 'Assignment', 'Submission', 'Topic', 'StreamComment',
  'StudentOrgMembership',
];
const PURGE_BY_EMAIL = [
  ['AchievementRequest', 'student_email'],
  ['StudentRecord', 'owner_student_email'],
  ['BlockWard', 'owner_student_email'],
  ['BlockWardVerificationRegistry', 'student_email'],
  ['Endorsement', 'endorser_email'],
  ['Endorsement', 'recipient_email'],
  ['SelfReportedAchievement', 'student_email'],
  ['StudentOrgMembership', 'student_email'],
  ['Notification', 'user_email'],
];

async function authorize(base44) {
  const check = await verifyTestSuperUser(base44);
  if (check.authorized) return { ok: true, email: check.user.email };
  const user = await base44.auth.me();
  if (!user) return { ok: false, status: 401, reason: 'Not authenticated' };
  const svc = base44.asServiceRole;
  const profiles = await svc.entities.UserProfile.filter({ user_email: user.email });
  const p = profiles[0];
  if (!p || p.user_type !== 'admin' || p.admin_level !== 'super_admin') {
    return { ok: false, status: 403, reason: 'Only super admins can manage demo data' };
  }
  return { ok: true, email: user.email };
}

async function findRequest(svc, email, title) {
  const rows = await svc.entities.AchievementRequest.filter({ student_email: email }, '-created_date', 200);
  return rows.find((r) => r.title === title) || null;
}

async function profileByEmail(svc, email) {
  const rows = await svc.entities.UserProfile.filter({ user_email: email });
  return rows[0] || null;
}

// ── The real organisation-verified flow: student submits → nominated verifier
// signs → (Tier 2: admin approves) → credentialDelivery publishes ──
async function ensureOrgCredential(svc, spec, heroProfile, actors, schoolByOrg) {
  const schoolId = schoolByOrg[spec.org].id;
  const verifierActor = spec.verifier === 'club_admin' ? actors.marcus : actors.daniel;
  const verifierName = spec.verifier === 'club_admin' ? 'Marcus Bell' : 'Daniel Okafor';

  let req = await findRequest(svc, HERO.email, spec.title);
  if (!req) {
    const res = await submitRequest(svc, actors.hero(schoolId), {
      action: 'submit',
      form: {
        school_id: schoolId,
        custom_credential_label: spec.label,
        category: spec.category,
        verification_tier: spec.tier,
        title: spec.title,
        description: spec.description,
        image_url: spec.cover,
        date_achieved: spec.date,
        evidence: [
          { type: 'file', url: spec.cover, name: `${spec.key}.png` },
          { type: 'link', url: `https://results.${spec.org === 'club' ? 'meridian-athletics' : 'northgate-grammar'}.example`, name: 'Official results page' },
        ],
        nominated_verifier_email: verifierActor.actor_email,
        is_team: false,
      },
    }, { ip: null, country: 'GB' });
    if (res.status !== 200 || !res.payload.ok) fail(`submit ${spec.key} failed: ${JSON.stringify(res.payload)}`);
    req = res.payload.request;
    // Cosmetic backdate so the submission history reads naturally and the
    // real per-organisation weekly cap keeps working across the demo set.
    if (spec.backdate) {
      await svc.entities.AchievementRequest.update(req.id, { submitted_at: ago(spec.backdate) });
    }
  }

  // Pending spec stays pending — it is the 'awaiting verification' state.
  if (spec.pending && ['submitted', 'under_review'].includes(req.status)) {
    return { request: req, registry: null };
  }

  // Advance through the real sign-off chain until published.
  for (let guard = 0; guard < 6; guard++) {
    if (req.status === 'archived') break;
    if (['submitted', 'under_review'].includes(req.status)) {
      const r = await runReviewerAction(svc, verifierActor, {
        action: 'sign', request_id: req.id,
        method: 'witnessed_in_person', attestation: true, signature: verifierName,
      }, { country: 'GB' });
      if (r.status !== 200 || !r.payload.ok) fail(`sign ${spec.key} failed: ${JSON.stringify(r.payload)}`);
    } else if (req.status === 'awaiting_second_approval') {
      const r = await runReviewerAction(svc, actors.priya, {
        action: 'admin_approve', request_id: req.id,
        method: 'official_records', attestation: true, signature: 'Dr. Priya Raghavan',
      }, { country: 'GB' });
      if (r.status !== 200 || !r.payload.ok) fail(`admin_approve ${spec.key} failed: ${JSON.stringify(r.payload)}`);
    } else if (req.status === 'approved') {
      const adminActor = spec.org === 'club' ? actors.marcus : actors.priya;
      const r = await runReviewerAction(svc, adminActor, { action: 'mint', request_id: req.id }, { country: 'GB' });
      if (r.status !== 200 || !r.payload.ok) fail(`mint ${spec.key} failed: ${JSON.stringify(r.payload)}`);
    } else {
      fail(`request ${spec.key} is in unexpected status ${req.status}`);
    }
    req = (await svc.entities.AchievementRequest.filter({ id: req.id }))[0];
  }
  if (req.status !== 'archived') fail(`request ${spec.key} did not reach archived`);

  const regs = await svc.entities.BlockWardVerificationRegistry.filter({ verification_id: req.verification_id });
  return { request: req, registry: regs[0] || null };
}

// ── The real independent flow: student submits → the account-free verifier
// receives a one-time emailed link → external_confirm signs + publishes ──
async function ensureIndependentCredential(svc, spec, heroProfile, actors) {
  let req = await findRequest(svc, HERO.email, spec.title);
  if (!req) {
    const res = await submitRequest(svc, actors.hero(null), {
      action: 'submit',
      form: {
        verification_mode: 'independent',
        title: spec.title,
        category: spec.category,
        description: spec.description,
        image_url: spec.cover,
        date_achieved: spec.date,
        evidence: [
          { type: 'file', url: spec.cover, name: `${spec.key}.png` },
          { type: 'link', url: `https://records.${spec.verifier.org.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.example`, name: 'Official record' },
        ],
        independent_verifier: {
          name: spec.verifier.name,
          email: spec.verifier.email,
          role: spec.verifier.role,
          organisation_label: spec.verifier.org,
          relationship: spec.relationship,
        },
      },
    }, { ip: null, country: 'GB' });
    if (res.status !== 200 || !res.payload.ok) fail(`submit ${spec.key} failed: ${JSON.stringify(res.payload)}`);
    req = (await svc.entities.AchievementRequest.filter({ id: res.payload.request.id }))[0];
    if (spec.backdate) {
      await svc.entities.AchievementRequest.update(req.id, { submitted_at: ago(spec.backdate) });
    }
  }

  for (let guard = 0; guard < 6; guard++) {
    if (req.status === 'archived') break;
    if (req.status === 'awaiting_external_verification') {
      // The exact call the emailed /external-verify page makes.
      const r = await runExternalAction(svc, {
        action: 'external_confirm',
        token: req.external_token,
        name: spec.verifier.name,
        role: spec.verifier.role,
        organisation: spec.verifier.org,
        email: spec.verifier.email,
        method: 'witnessed_in_person',
        attestation: true,
        signature: spec.verifier.name,
      }, { ip: null, country: 'GB' });
      if (r.status !== 200 || !r.payload.ok) fail(`external_confirm ${spec.key} failed: ${JSON.stringify(r.payload)}`);
    } else if (req.status === 'approved') {
      const r = await retryMint(svc, actors.hero(null), { request_id: req.id });
      if (r.status !== 200 || !r.payload.ok) fail(`retry_mint ${spec.key} failed: ${JSON.stringify(r.payload)}`);
    } else {
      fail(`request ${spec.key} is in unexpected status ${req.status}`);
    }
    req = (await svc.entities.AchievementRequest.filter({ id: req.id }))[0];
  }
  if (req.status !== 'archived') fail(`request ${spec.key} did not reach archived`);

  const regs = await svc.entities.BlockWardVerificationRegistry.filter({ verification_id: req.verification_id });
  return { request: req, registry: regs[0] || null };
}

// ── One genuine on-chain mint on the app's real Sepolia contract — the same
// issueAward call the (currently dormant) issueBlockwardV2 flow uses. Fails
// soft: the credential is fully valid without it, nft_status stays 'pending'. ──
async function mintOnChain(svc, heroProfile, registry) {
  const RPC = Deno.env.get('SEPOLIA_RPC_URL');
  const CONTRACT = Deno.env.get('CONTRACT_ADDRESS');
  const PK = Deno.env.get('ISSUER_PRIVATE_KEY');
  const NET = Deno.env.get('NETWORK');
  if (!RPC || !CONTRACT || !PK || NET !== 'sepolia') {
    return { ok: false, reason: 'blockchain network not configured' };
  }

  // Demo custodial wallet: a fresh address for the student. The key is never
  // stored anywhere — the credential is a soulbound token and lives at the
  // address, exactly like a custodial wallet with the key held in Vaults.
  let studentAddr = heroProfile.wallet_address;
  if (!studentAddr) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    studentAddr = privateKeyToAccount(bytes).address;
    await svc.entities.UserProfile.update(heroProfile.id, { wallet_address: studentAddr });
  }

  const account = privateKeyToAccount(PK);
  const meta = {
    name: registry.achievement_title,
    description: registry.achievement_description || '',
    category: registry.achievement_category,
    external_url: registry.public_verification_url,
  };
  const uri = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(JSON.stringify(meta))));
  const ABI = parseAbi([
    'function issueAward(address studentVault, address teacherVault, bytes32 awardType_, string tokenURI_)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  ]);

  const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
  const wal = createWalletClient({ account, chain: sepolia, transport: http(RPC) });

  const sim = await pub.simulateContract({
    account, address: CONTRACT, abi: ABI, functionName: 'issueAward',
    args: [getAddress(studentAddr), account.address, encodeBytes32String(registry.achievement_category || 'special'), uri],
  });
  const mintHash = await wal.writeContract(sim.request);
  const receipt = await Promise.race([
    pub.waitForTransactionReceipt({ hash: mintHash }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('transaction wait timed out')), 45000)),
  ]);
  if (receipt.status !== 'success') return { ok: false, reason: 'mint reverted', tx: mintHash };

  let tokenId = null;
  const transferSig = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  for (const log of receipt.logs) {
    if (log.topics[0]?.toLowerCase() === transferSig && log.topics.length === 4) {
      tokenId = BigInt(log.topics[3]).toString();
      break;
    }
  }
  if (tokenId === null) return { ok: false, reason: 'no tokenId in receipt', tx: mintHash };

  await svc.entities.BlockWardVerificationRegistry.update(registry.id, {
    nft_status: 'minted',
    blockchain_network: 'sepolia',
    contract_address: CONTRACT,
    token_id: tokenId,
    transaction_hash: receipt.transactionHash,
  });
  if (registry.blockward_id) {
    await svc.entities.BlockWard.update(registry.blockward_id, { token_id: tokenId, transaction_hash: receipt.transactionHash });
  }
  if (registry.student_record_id) {
    await svc.entities.StudentRecord.update(registry.student_record_id, {
      nft_token_id: tokenId,
      nft_transaction_hash: receipt.transactionHash,
      minted_at: new Date().toISOString(),
    });
  }
  return { ok: true, tx: receipt.transactionHash, token_id: tokenId, block: receipt.blockNumber ? String(receipt.blockNumber) : null, student_wallet: studentAddr };
}

// ── Gradebook helpers ──
const gradeFor = (pct) =>
  pct >= 90 ? 'A*' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : pct >= 40 ? 'E' : 'U';
const attStatus = (i, d) => {
  const v = (i * 5 + d * 3 + ((i + d) % 4)) % 23;
  return v === 2 || v === 15 ? 'late' : v === 21 ? 'absent' : 'present';
};

export default async function (req) {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const auth = await authorize(base44);
    if (!auth.ok) return Response.json({ error: auth.reason }, { status: auth.status });
    const callerEmail = auth.email;

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'status';
    const svc = base44.asServiceRole;

    // ══════════════════════════ status ══════════════════════════
    if (action === 'status') {
      const runs = (await svc.entities.DemoSeedRun.filter({ status: 'active' })).filter((r) => r.kind === 'investor_world');
      const run = runs[0] || null;
      if (!run) return Response.json({ ok: true, active: false });
      const hero = await profileByEmail(svc, HERO.email);
      const regs = hero ? await svc.entities.BlockWardVerificationRegistry.filter({ student_id: hero.id }) : [];
      return Response.json({
        ok: true, active: true,
        run: { label: run.run_label, schools: run.school_ids, accounts: (run.student_emails || []).length },
        hero: hero ? { handle: hero.handle, verified_credentials: regs.filter((r) => r.approval_status === 'approved').length } : null,
      });
    }

    // ══════════════════════════ remove ══════════════════════════
    if (action === 'remove') {
      const runs = (await svc.entities.DemoSeedRun.filter({ status: 'active' })).filter((r) => r.kind === 'investor_world');
      if (runs.length === 0) return Response.json({ error: 'No active investor demo world found' }, { status: 404 });
      const deleted = {};
      for (const run of runs) {
        const protectedEmails = new Set([callerEmail, (run.created_by_email || '').toLowerCase()].map((e) => (e || '').toLowerCase()));
        const emails = (run.student_emails || []).map((e) => e.toLowerCase()).filter((e) => !protectedEmails.has(e));

        // 1. Everything school-scoped, per organisation.
        for (const schoolId of run.school_ids || [run.school_id]) {
          for (const name of PURGE_BY_SCHOOL) {
            try {
              const items = await svc.entities[name].filter({ school_id: schoolId });
              if (items.length > 0) await svc.entities[name].deleteMany({ school_id: schoolId });
              deleted[name] = (deleted[name] || 0) + items.length;
            } catch (e) {
              deleted[name] = deleted[name] === undefined ? -1 : deleted[name];
            }
          }
          try { await svc.entities.School.delete(schoolId); deleted.School = (deleted.School || 0) + 1; } catch (e) { /* next */ }
        }

        // 2. School-less records by the seeded emails (independent
        //    credentials, self-reported achievements, notifications).
        for (const [name, field] of PURGE_BY_EMAIL) {
          for (const email of emails) {
            try {
              const items = await svc.entities[name].filter({ [field]: email });
              if (items.length > 0) await svc.entities[name].deleteMany({ [field]: email });
              deleted[name] = (deleted[name] || 0) + items.length;
            } catch (e) { /* best-effort */ }
          }
        }

        // 3. The profiles themselves.
        let profiles = 0;
        const seen = new Set();
        for (const email of emails) {
          const p = await profileByEmail(svc, email);
          if (p && !seen.has(p.id)) { seen.add(p.id); await svc.entities.UserProfile.delete(p.id); profiles++; }
        }
        deleted.UserProfile = (deleted.UserProfile || 0) + profiles;

        await svc.entities.DemoSeedRun.update(run.id, { status: 'removed', removed_at: new Date().toISOString() });
      }
      return Response.json({ ok: true, deleted });
    }

    if (action !== 'seed') return Response.json({ error: 'Unknown action. Use seed | remove | status.' }, { status: 400 });

    // ══════════════════════════ seed ══════════════════════════
    const existingRuns = (await svc.entities.DemoSeedRun.filter({ status: 'active' })).filter((r) => r.kind === 'investor_world');
    if (existingRuns.length > 0) {
      return Response.json({ error: 'The investor demo world is already seeded. Remove it first with { "action": "remove" }.' }, { status: 409 });
    }

    // ── 1. Two organisations through the REAL setupSchool path ──
    let school = (await svc.entities.School.filter({ name: SCHOOL_NAME }))[0] || null;
    let schoolCodes;
    if (!school) {
      const created = await createSchoolForAdmin(svc, {
        user: { email: SCHOOL_ADMIN.email, full_name: `Dr. ${SCHOOL_ADMIN.first} ${SCHOOL_ADMIN.last}` },
        profile: null,
        name: SCHOOL_NAME,
        school_type: 'secondary_school',
        country: 'United Kingdom',
        city: 'London',
        website: 'https://northgate-grammar.example',
        contact_email: SCHOOL_ADMIN.email,
        logo_url: IMAGES.school_logo,
        admin_full_name: `Dr. ${SCHOOL_ADMIN.first} ${SCHOOL_ADMIN.last}`,
        admin_job_title: 'Principal',
      });
      school = created.school;
      schoolCodes = created.codes;
    } else {
      const codes = await svc.entities.SchoolCode.filter({ school_id: school.id });
      const t = codes.find((c) => c.role_type === 'teacher');
      const s = codes.find((c) => c.role_type === 'student');
      schoolCodes = { teacher: t?.code, student: s?.code };
    }

    let club = (await svc.entities.School.filter({ name: CLUB_NAME }))[0] || null;
    if (!club) {
      const created = await createSchoolForAdmin(svc, {
        user: { email: CLUB_ADMIN.email, full_name: `${CLUB_ADMIN.first} ${CLUB_ADMIN.last}` },
        profile: null,
        name: CLUB_NAME,
        school_type: 'other',
        country: 'United Kingdom',
        city: 'Manchester',
        website: 'https://meridian-athletics.example',
        contact_email: CLUB_ADMIN.email,
        logo_url: IMAGES.club_logo,
        admin_full_name: `${CLUB_ADMIN.first} ${CLUB_ADMIN.last}`,
        admin_job_title: 'Head Coach',
      });
      club = created.school;
    }
    // Verified organisations with real branding (mirrors what BlockWard
    // verification staff set — so issuer branding shows verified status).
    if (school.verification_status !== 'verified') {
      await svc.entities.School.update(school.id, { verification_status: 'verified', logo_url: IMAGES.school_logo });
    }
    if (club.verification_status !== 'verified' || club.org_type !== 'sports_club') {
      await svc.entities.School.update(club.id, { verification_status: 'verified', org_type: 'sports_club', logo_url: IMAGES.club_logo });
    }

    // Registry FIRST — even a partial seed is always removable.
    const run = await svc.entities.DemoSeedRun.create({
      run_label: 'investor-' + Date.now(),
      kind: 'investor_world',
      school_id: school.id,
      school_ids: [school.id, club.id],
      school_name: SCHOOL_NAME,
      created_by_email: callerEmail,
      status: 'active',
      teacher_emails: [TEACHER.email, SCHOOL_ADMIN.email, CLUB_ADMIN.email],
      student_emails: [HERO.email],
    });

    // ── 2. Staff: one teacher (real join-code → real approval engine) ──
    await provisionProfile(svc, { email: TEACHER.email, full_name: `${TEACHER.first} ${TEACHER.last}` }, {
      first_name: TEACHER.first, last_name: TEACHER.last,
      join_code: schoolCodes.teacher, date_of_birth: TEACHER.dob,
    });
    let teacherProfile = await profileByEmail(svc, TEACHER.email);
    if (teacherProfile.user_type !== 'teacher' || teacherProfile.school_id !== school.id) {
      const mem = (await svc.entities.StaffMembership.filter({ school_id: school.id, user_email: TEACHER.email }))[0];
      if (mem && mem.status !== 'active') {
        const r = await reviewStaffMembership(svc, {
          membership_id: mem.id, action: 'approve',
          approver: { email: SCHOOL_ADMIN.email, name: `Dr. ${SCHOOL_ADMIN.first} ${SCHOOL_ADMIN.last}` },
        });
        if (!r.ok) fail(`teacher approval failed: ${r.error || JSON.stringify(r)}`);
      } else if (!mem) {
        fail('teacher joined but no StaffMembership was created');
      }
      teacherProfile = await profileByEmail(svc, TEACHER.email);
    }

    // ── 3. The hero student through the real student-code path ──
    const heroRes = await provisionProfile(svc, { email: HERO.email, full_name: `${HERO.first} ${HERO.last}` }, {
      first_name: HERO.first, last_name: HERO.last,
      join_code: schoolCodes.student, date_of_birth: HERO.dob,
    });
    let heroProfile = await profileByEmail(svc, HERO.email);

    // Public profile customisation — validated presets, the same rules
    // updatePublicProfile enforces (handle availability checked through the
    // real shared module).
    const handleCheck = await isHandleAvailable(svc, HERO.handle, heroProfile.id);
    if (!handleCheck.available) fail(`handle @${HERO.handle} unavailable: ${handleCheck.reason}`);
    await svc.entities.UserProfile.update(heroProfile.id, {
      handle: HERO.handle,
      handle_changed_at: new Date().toISOString(),
      grade_level: 'Year 12',
      student_id: 'NGS-2417',
      avatar_url: IMAGES.avatar,
      bio: 'Year 12 at Northgate Grammar. 400m sprinter at Meridian Athletics, Grade 8 violinist, 1850-rated chess player. Building things that matter.',
      banner_url: IMAGES.banner,
      theme_id: 'midnight',
      accent_colour: '#7c3aed',
      profile_layout: 'grid',
      display_font: 'sans',
      social_links: [
        { platform: 'instagram', url: 'https://instagram.com/maya.builds', label: 'Instagram' },
        { platform: 'github', url: 'https://github.com/maya-ellison', label: 'GitHub' },
      ],
      featured_link: { url: 'https://maya.builds.example', label: 'My build log' },
    });
    heroProfile = await profileByEmail(svc, HERO.email);

    // Hero is also a member of the athletics club (multi-org memberships are
    // the real cross-org mechanism; approved by the club admin).
    const clubMembership = await svc.entities.StudentOrgMembership.filter({ student_email: HERO.email, school_id: club.id });
    if (clubMembership.length === 0) {
      await svc.entities.StudentOrgMembership.create({
        student_id: heroProfile.id, student_email: HERO.email, student_name: 'Maya Ellison',
        school_id: club.id, school_name: CLUB_NAME, org_type: 'sports_club',
        status: 'active', origin: 'org_invite',
        requested_at: ago(200), responded_at: ago(198),
        approved_by_email: CLUB_ADMIN.email, approved_by_name: 'Marcus Bell',
      });
    }

    // ── 4. A class of 24 students with plausible names ──
    const classmates = [];
    const specs = CLASSMATES.map(([first, last], i) => ({
      email: `${first}.${last}@${D}`.toLowerCase(),
      first, last,
      dob: `2009-${String((i % 9) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
    }));
    for (let c = 0; c < specs.length; c += 6) {
      const batch = await Promise.all(specs.slice(c, c + 6).map((spec) =>
        provisionProfile(svc, { email: spec.email, full_name: `${spec.first} ${spec.last}` }, {
          first_name: spec.first, last_name: spec.last,
          join_code: schoolCodes.student, date_of_birth: spec.dob,
        }).then((r) => ({ email: spec.email, profile: r.profile, name: `${spec.first} ${spec.last}` }))
      ));
      classmates.push(...batch);
    }
    const allStudents = [{ email: HERO.email, profile: heroProfile, name: 'Maya Ellison' }, ...classmates];

    let cls = (await svc.entities.Class.filter({ school_id: school.id, name: 'Year 12 Mathematics — Set 1' }))[0] || null;
    if (!cls) {
      cls = await svc.entities.Class.create({
        school_id: school.id,
        name: 'Year 12 Mathematics — Set 1',
        subject: 'Mathematics',
        teacher_email: TEACHER.email,
        student_emails: allStudents.map((s) => s.email),
        grade_level: 'Year 12',
        room: 'M-101',
        join_code: 'DEMO12M',
        color: '#7c3aed',
        status: 'active',
      });
      await svc.entities.Enrollment.bulkCreate(allStudents.map((s) => ({
        school_id: school.id, class_id: cls.id, class_name: cls.name,
        student_email: s.email, student_name: s.name, status: 'active',
      })));
      await svc.entities.UserProfile.bulkUpdate(allStudents.map((s) => ({ id: s.profile.id, class_ids: [cls.id] })));
    }

    // ── 5. A week of timetable entries ──
    const existingTimetable = await svc.entities.TimetableEntry.filter({ class_id: cls.id });
    if (existingTimetable.length === 0) {
      const slots = [
        { day: 0, start: '09:00', end: '10:00' },
        { day: 1, start: '11:00', end: '12:00' },
        { day: 2, start: '09:00', end: '10:00' },
        { day: 3, start: '11:00', end: '12:00' },
        { day: 4, start: '09:00', end: '10:00' },
      ];
      await svc.entities.TimetableEntry.bulkCreate(slots.map((s, i) => ({
        school_id: school.id, class_id: cls.id, class_name: cls.name,
        teacher_email: TEACHER.email, day_of_week: s.day,
        start_time: s.start, end_time: s.end, room: 'M-101',
        subject: 'Mathematics', period_number: i + 1,
      })));
    }

    // ── 6. Three weeks of attendance history (realistic mix) ──
    const lessonDates = [];
    const cursor = new Date();
    while (lessonDates.length < 15) {
      cursor.setDate(cursor.getDate() - 1);
      const dow = cursor.getDay();
      if (dow !== 0 && dow !== 6) lessonDates.push(cursor.toISOString().slice(0, 10));
    }
    for (let d = 0; d < lessonDates.length; d++) {
      const date = lessonDates[d];
      const existing = await svc.entities.AttendanceSession.filter({ class_id: cls.id, date });
      if (existing.length > 0) continue;
      const counts = { present: 0, absent: 0, late: 0 };
      allStudents.forEach((s, i) => { counts[attStatus(i, d)]++; });
      const session = await svc.entities.AttendanceSession.create({
        school_id: school.id, class_id: cls.id, class_name: cls.name,
        teacher_email: TEACHER.email, date,
        session_start_time: '09:00', session_end_time: '10:00',
        created_by_email: TEACHER.email,
        created_at: new Date(date + 'T09:00:00Z').toISOString(),
        marks_count: allStudents.length,
        present_count: counts.present, absent_count: counts.absent, late_count: counts.late,
      });
      await svc.entities.AttendanceRecord.bulkCreate(allStudents.map((s, i) => ({
        school_id: school.id, class_id: cls.id, class_name: cls.name,
        student_email: s.email, student_name: s.name, date,
        status: attStatus(i, d),
        marked_by_email: TEACHER.email, marked_by_name: `${TEACHER.first} ${TEACHER.last}`,
        marked_at: new Date(date + 'T09:05:00Z').toISOString(),
        attendance_session_id: session.id,
      })));
    }

    // ── 7. Gradebook with entered marks ──
    const assessments = [
      { title: 'Term 1 Test — Algebra & Calculus', type: 'test', max: 60, days: 8, weight: 40 },
      { title: 'Algebra Investigation Coursework', type: 'coursework', max: 40, days: 19, weight: 20 },
    ];
    for (let a = 0; a < assessments.length; a++) {
      const spec = assessments[a];
      let assessment = (await svc.entities.Assessment.filter({ class_id: cls.id, title: spec.title }))[0] || null;
      if (!assessment) {
        assessment = await svc.entities.Assessment.create({
          school_id: school.id, class_id: cls.id, class_name: cls.name,
          subject: 'Mathematics',
          teacher_email: TEACHER.email, teacher_id: teacherProfile.id,
          teacher_name: `${TEACHER.first} ${TEACHER.last}`,
          title: spec.title, assessment_type: spec.type,
          date: day(spec.days), max_score: spec.max, weighting: spec.weight,
          status: 'published', published_at: ago(spec.days - 1), published_by: TEACHER.email,
        });
        const grades = allStudents.map((s, i) => {
          const score = Math.max(12, Math.round(spec.max * (0.52 + ((i * 7 + a * 13) % 47) / 100)));
          const pct = Math.round((score / spec.max) * 100);
          return {
            school_id: school.id, student_email: s.email, student_id: s.profile.id, student_name: s.name,
            assessment_id: assessment.id, assessment_title: spec.title, assessment_type: spec.type,
            assessment_date: day(spec.days), class_id: cls.id, class_name: cls.name, subject: 'Mathematics',
            teacher_email: TEACHER.email, teacher_id: teacherProfile.id, teacher_name: `${TEACHER.first} ${TEACHER.last}`,
            raw_score: score, max_score: spec.max, percentage: pct, grade_value: gradeFor(pct),
            teacher_comment: pct >= 95 ? 'Outstanding work — best in the year.' : null,
            status: 'published', published_at: ago(spec.days - 2), published_by: TEACHER.email,
          };
        });
        await svc.entities.StudentGrade.bulkCreate(grades);
      }
    }

    // ── 8. A seating plan: desks placed, every student assigned (teacher POV —
    // the front wall and teacher's desk anchor the bottom edge of the canvas) ──
    const existingPlan = await svc.entities.SeatingPlan.filter({ class_id: cls.id });
    if (existingPlan.length === 0) {
      const desks = [];
      let n = 1;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
          const a = allStudents[(n * 2 - 2) % allStudents.length];
          const b = allStudents[(n * 2 - 1) % allStudents.length];
          desks.push({
            id: `desk-${n}`, type: 'desk', x: 90 + col * 290, y: 60 + row * 140,
            w: 230, h: 95, seats: 2, seatLayout: 'row', label: `Desk ${n}`,
            assignments: [a.email, b.email],
          });
          n++;
        }
      }
      await svc.entities.SeatingPlan.create({
        school_id: school.id, class_id: cls.id, class_name: cls.name,
        teacher_email: TEACHER.email, name: 'Default', is_default: true,
        layout_json: {
          room: { width: 1000, height: 720, label: 'Room M-101' },
          elements: [
            { id: 'el-door', type: 'door', x: 952, y: 300, w: 30, h: 90 },
            { id: 'el-window', type: 'window', x: 10, y: 220, w: 26, h: 220 },
            { id: 'el-board', type: 'whiteboard', x: 250, y: 700, w: 500, h: 16 },
            { id: 'el-teacher', type: 'teacherDesk', x: 380, y: 625, w: 240, h: 55 },
            ...desks,
          ],
        },
      });
    }

    // ── 9. The 10 achievements through the REAL flows ──
    const actors = {
      hero: (schoolId) => ({
        authorized: true, actor_id: heroProfile.id, actor_email: HERO.email, actor_role: 'student',
        school_id: schoolId, first_name: HERO.first, last_name: HERO.last,
      }),
      daniel: {
        authorized: true, actor_id: teacherProfile.id, actor_email: TEACHER.email, actor_role: 'teacher',
        school_id: school.id, first_name: TEACHER.first, last_name: TEACHER.last,
      },
      priya: {
        authorized: true, actor_id: (await profileByEmail(svc, SCHOOL_ADMIN.email))?.id, actor_email: SCHOOL_ADMIN.email, actor_role: 'admin',
        school_id: school.id, first_name: SCHOOL_ADMIN.first, last_name: SCHOOL_ADMIN.last,
      },
      marcus: {
        authorized: true, actor_id: (await profileByEmail(svc, CLUB_ADMIN.email))?.id, actor_email: CLUB_ADMIN.email, actor_role: 'admin',
        school_id: club.id, first_name: CLUB_ADMIN.first, last_name: CLUB_ADMIN.last,
      },
    };
    const schoolByOrg = { school: school, club: club };

    const registries = {};
    for (const spec of ACHIEVEMENTS) {
      const result = spec.independent
        ? await ensureIndependentCredential(svc, spec, heroProfile, actors)
        : await ensureOrgCredential(svc, spec, heroProfile, actors, schoolByOrg);
      registries[spec.key] = result.registry;
    }

    // Self-reported, unverified (the day-one portfolio section)
    const selfExisting = await svc.entities.SelfReportedAchievement.filter({ student_email: HERO.email, title: SELF_REPORTED.title });
    if (selfExisting.length === 0) {
      await svc.entities.SelfReportedAchievement.create({
        student_id: heroProfile.id, student_email: HERO.email, student_name: 'Maya Ellison',
        title: SELF_REPORTED.title, description: SELF_REPORTED.description,
        image_url: SELF_REPORTED.cover, domain: SELF_REPORTED.domain,
        date_achieved: SELF_REPORTED.date,
        evidence: [{ type: 'link', url: 'https://maya.builds.example/planner', name: 'Live app' }],
        status: 'unverified', organisation_name: 'Personal project',
      });
    }

    // ── 10. Peer endorsements from seeded classmates (real scarcity rules) ──
    for (const e of ENDORSEMENTS) {
      const registry = registries[e.key];
      if (!registry) fail(`endorsement target ${e.key} has no registry record`);
      const classmate = classmates[e.from];
      const existing = await svc.entities.Endorsement.filter({ endorser_id: classmate.profile.id, registry_id: registry.id });
      if (existing.some((x) => x.status === 'active')) continue;
      const actor = {
        authorized: true, actor_id: classmate.profile.id, actor_email: classmate.email, actor_role: 'student',
        school_id: school.id, first_name: classmate.name.split(' ')[0], last_name: classmate.name.split(' ')[1],
      };
      const r = await endorseAchievement(svc, {
        actor, actorProfile: classmate.profile,
        actorName: classmate.name, actorHandle: classmate.profile.handle || null,
        affiliation: buildAffiliation('student', SCHOOL_NAME),
        registryId: registry.id, text: e.text,
      });
      if (!r.ok) fail(`endorsement from ${classmate.name} failed: ${r.error}`);
    }

    // ── 11. Pin 3 highlights (both badge tiers side by side at the top) ──
    const pins = [registries.county_final?.id, registries.math_prize?.id, registries.karate?.id].filter(Boolean);
    if (pins.length === 3) {
      await svc.entities.UserProfile.update(heroProfile.id, { pinned_achievement_ids: pins });
    }

    // ── 12. One genuine on-chain mint for the flagship credential ──
    let chain = { ok: false, reason: 'no registry record' };
    if (registries.math_prize) {
      try {
        chain = await mintOnChain(svc, heroProfile, registries.math_prize);
      } catch (e) {
        chain = { ok: false, reason: e?.message || String(e) };
      }
    }

    // ── 13. Caller browsing access to the demo school (member, not owner) ──
    const callerProfile = await profileByEmail(svc, callerEmail);
    const callerMembership = await svc.entities.AdminSchoolMembership.filter({ admin_email: callerEmail, school_id: school.id });
    if (callerMembership.length === 0) {
      await svc.entities.AdminSchoolMembership.create({
        admin_user_id: callerProfile ? callerProfile.id : callerEmail,
        admin_email: callerEmail,
        admin_name: callerProfile ? `${callerProfile.first_name} ${callerProfile.last_name}`.trim() : callerEmail,
        school_id: school.id, school_name: school.name,
        role: 'admin', status: 'active', is_primary: false,
        joined_at: new Date().toISOString(),
      });
    }

    // ── 14. Update the manifest + verify the end-to-end outcome ──
    const heroEmails = allStudents.map((s) => s.email);
    await svc.entities.DemoSeedRun.update(run.id, {
      student_emails: [TEACHER.email, SCHOOL_ADMIN.email, CLUB_ADMIN.email, KARATE_VERIFIER.email, CHESS_VERIFIER.email, ...heroEmails],
      student_count: allStudents.length,
      seeded_at: new Date().toISOString(),
    });

    const heroRegistry = await svc.entities.BlockWardVerificationRegistry.filter({ student_id: heroProfile.id });
    const verified = heroRegistry.filter((r) => r.approval_status === 'approved');
    const orgVerified = verified.filter((r) => r.verification_mode === 'organisation');
    const indepVerified = verified.filter((r) => r.verification_mode === 'independent');
    const heroRecords = await svc.entities.StudentRecord.filter({ owner_student_email: HERO.email });
    const vaultDelivered = heroRecords.filter((r) => r.delivered_to_student_vault && r.vault_status === 'delivered');

    const karateReq = await findRequest(svc, HERO.email, ACHIEVEMENTS.find((a) => a.key === 'karate').title);
    const chessReq = await findRequest(svc, HERO.email, ACHIEVEMENTS.find((a) => a.key === 'chess').title);
    const pendingReq = await findRequest(svc, HERO.email, ACHIEVEMENTS.find((a) => a.key === 'volunteering').title);

    const independentE2E = {
      karate: {
        request_status: karateReq?.status,
        signed_via_emailed_link: !!karateReq?.external_signoff?.signature,
        verifier: karateReq?.external_signoff ? `${karateReq.external_signoff.name} (${karateReq.external_signoff.role}, ${karateReq.external_signoff.organisation})` : null,
        review_flags_recorded: (karateReq?.review_flags || []).map((f) => f.reason),
        verification_id: karateReq?.verification_id,
        registry_delivered: !!registries.karate,
      },
      chess: {
        request_status: chessReq?.status,
        signed_via_emailed_link: !!chessReq?.external_signoff?.signature,
        verification_id: chessReq?.verification_id,
      },
      vault: {
        records: heroRecords.length,
        delivered_to_vault: vaultDelivered.length,
        appears_under_verified: verified.length,
      },
    };

    const verificationUrls = verified.map((r) => r.public_verification_url).filter(Boolean);

    return Response.json({
      ok: true,
      world: {
        school: { id: school.id, name: SCHOOL_NAME, verified: true, logo: IMAGES.school_logo },
        club: { id: club.id, name: CLUB_NAME, org_type: 'sports_club', verified: true, logo: IMAGES.club_logo },
        hero: {
          name: 'Maya Ellison', handle: HERO.handle, year: 'Year 12',
          profile_url: `${appUrl()}/@${HERO.handle}`,
        },
        teacher: { name: 'Daniel Okafor', status: teacherProfile.status, school_linked: teacherProfile.school_id === school.id },
        class: { name: cls.name, students: allStudents.length },
        attendance_sessions: lessonDates.length,
        gradebook: { assessments: assessments.length, grades: assessments.length * allStudents.length },
        seating_plan: true,
        endorsements: ENDORSEMENTS.length,
        highlights_pinned: pins.length,
      },
      achievements: {
        organisation_verified: orgVerified.length,
        independently_verified: indepVerified.length,
        pending_review: pendingReq ? pendingReq.status : null,
        self_reported: 1,
      },
      blockchain: chain,
      independent_e2e: independentE2E,
      verification_urls: verificationUrls,
    });
  } catch (error) {
    console.error('seedInvestorDemo error:', error);
    return Response.json({ error: error.message || 'Seed failed' }, { status: 500 });
  }
}