# Checkpoint — Before Beta Readiness

Created 2026-09-24 before the Beta Readiness work (public site claims, legal pages, SEO, duplicate-page consolidation, demo profile, auth reliability, critical-path tests).

## State at checkpoint
- Phase 7 admin features complete and tested (credential revocation, reports, alerts, evidence configuration).
- All P7 test artifacts cleaned up; kept_types for test school = 0.
- AwardTypes.requires_evidence default true; achievementRequestFlow honours explicit opt-out.
- Public site: Home, ForOrganisations, DemoProfile, About, Documentation, Security, Privacy, Terms, Contact live.
- Known issues: /privacy renders auto-generated page list (no real policy); auth redirect loop page (AuthLoopError) exists; duplicate credential/attendance/grades/admin pages exist.
- Blockchain anchors on Sepolia testnet.
- Google Drive connector registered but Drive archiving not verified end-to-end.

## Restore point
No source files were deleted or rewritten in this checkpoint; restore by reverting individual file edits listed in the Beta Readiness END REPORT.