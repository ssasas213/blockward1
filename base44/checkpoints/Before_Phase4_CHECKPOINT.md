# Checkpoint — Before Phase 4 (Student Vault and Public Profile)

Date: 2026-09-24. No code changes made yet under Phase 4.

## Purpose
Extend the EXISTING student vault and public profile. No redesign, no V2, preserve
Test Mode and all existing links (/@handle, /portfolio/:studentId, /verify/:id).

## State at checkpoint
- Anchored credential BW-2026-PH3ANCH1 (token #19) confirmed on Sepolia from Phase 3.
- Phase 3 fixtures exist (test student / BlockWard Test School, plus verification
  state fixtures). BlockWard Test School may be unverified (anchoring paused for it).
- publicVerify enforces: registry status, chain check (six-point), hash_mismatch,
  never shows verified unless confirmed. Cache TTL 10min confirmed / 2min otherwise.

## Phase 4 scope (from user)
Vault (private): all achievements + credentials, search/filters, evidence +
approval history + verification status, clear labels (self-added / internally
approved / externally approved / blockchain-confirmed / revoked / superseded),
view/share/verify actions, QR + certificate linking to the LIVE verification page,
export of own records.

Public profile: keep existing themes/layout/bio/image/highlights/categories/section
order; per-item and whole-profile visibility controls; grades public ONLY if the
student explicitly opts in; NEVER public: attendance, behaviour, teacher comments,
DOB, contact details, private evidence; public profile reads only public-safe
fields.

Tests to run: single confirmed achievement in vault surviving logout/login;
public profile shows only selected items; hidden items unreachable by direct URL;
legacy links work; QR + certificate open correct live verification page.

Optional (only if time): saved profile views (university, employment, scholarship, sport).