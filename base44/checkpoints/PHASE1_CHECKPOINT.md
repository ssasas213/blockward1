# PHASE 1 CHECKPOINT — Roles, Onboarding & Security Foundation
Created BEFORE any Phase 1 changes (2026-09-24, Asia/Dubai).

## Purpose
A written checkpoint of the project state immediately before Phase 1 edits.
For a full app snapshot, clone the app from the dashboard (App Settings → Clone)
before proceeding — this file records scope and known-good state only.

## State at checkpoint (from Phase 0 audit, same session)
- ~90 pages, 45 entities, ~105 backend functions, 5 workflows.
- Canonical credential flow: AchievementRequest → StudentRecord → BlockWard +
  BlockWardVerificationRegistry (/verify/BW-…). Corrections version records.
- On-chain minting (issueBlockward / issueBlockwardV2) DORMANT by design.
- Test Mode server-authorised (TEST_MODE_ENABLED + TEST_SUPER_USER_EMAIL,
  resolveEffectiveActor / requireRealIdentity in shared/testMode.ts).
- Public pages (Home, Signup, DemoProfile, Verify, /@handle, /org, /team)
  render through public functions; no SchoolProvider dependency on public routes.

## Known gaps this phase will address (from Phase 0 audit)
1. StudentRecord RLS allows matched teachers/admins to bypass credentialEditAction
   and mutate ATTESTED fields directly → tighten update rule.
2. Announcement read rule uses {{user.data.class_ids}} (suspect template).
3. SchoolCode / DigitalSignature / Enrollment / Resource / TimetableEntry reads
   are school-wide — pending teachers and students can read other people's data.
4. AuditLog is record-scoped only — no membership/role-change audit entries.
5. setupSchool does not prevent duplicate organisations.
6. Auth loading gate (App.jsx) can spin indefinitely on a stalled backend.

## Standing rules in force
Extend existing entities/pages/functions; preserve Test Mode, profile links and
verification links; security enforced in entity permissions + backend functions;
no PII on chain; no green Verified badge without real verification.