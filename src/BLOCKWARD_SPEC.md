# BlockWard Digital Custodian — System Audit & Final Spec

> **Audit date**: 2026-06-16  
> **Audit method**: Code review of all 7 backend functions + 12 frontend components + live database inspection

---

## 1. PROFILE BLANK PAGE ✅ FIXED

**Status**: Fixed in prior session.  
**Root cause**: `ProtectedRoute` with `requireProfile=true` redirected to `/Onboarding` before profile loaded.  
**Fix**: Removed `ProtectedRoute`, wrapped return in `ProfileErrorBoundary`, added `DriveVaultSection`.

---

## 2. TEACHER FLOW — Submit For Approval

**Backend**: `functions/recordWorkflow.js` — Correctly implements the full state machine:

| Action | From | To | Role |
|---|---|---|---|
| `submitRecord` | `draft` | `awaiting_teacher_signature` | student |
| `teacherSubmitRecord` | `draft` | `awaiting_teacher_signature` | teacher |
| `teacherSignRecord` | `awaiting_teacher_signature` | `awaiting_admin_signature` | teacher |
| `teacherRejectRecord` | `awaiting_teacher_signature` | `rejected` | teacher |
| `adminSignRecord` | `awaiting_admin_signature` | `approved` | admin |
| `adminRejectRecord` | `awaiting_admin_signature` | `rejected` | admin |

**Verified**: Role checks, school_id isolation, status transition validation all correct.

**BUG FOUND — Skipped Teacher Signature Step**:  
The existing record `6a2457527cb66d90d0f0650b` was created by teacher Sarah Ahmed. The audit log shows it went directly from `draft` → `awaiting_admin_signature` (action: "submitted", note: "Submitted for admin review"). The teacher signature step was SKIPPED. The record has `teacher_name: 'Sarah Ahmed'` but `teacher_signed` is not set, no `teacher_signature_id` exists.

This means the record cannot advance — `adminSignRecord` would work (it only checks status === `awaiting_admin_signature`), but the record lacks the teacher_signature_id that `mintAndArchive` and `saveToStudentDrive` require (`record.teacher_signed` must be true).

**Fix needed**: The record should have gone `draft` → `awaiting_teacher_signature` → (teacher signs) → `awaiting_admin_signature`. Requires re-creating records properly.

---

## 3. TEACHER SIGNATURE SETUP

**Status**: Partially working, blocked by suspended accounts.

**What works**:
- `SignatureSetup.jsx` — Full dialog with typed + drawn signature tabs, saves to `SignatureProfile` entity
- `SignatureConfirmDialog.jsx` — Reuses saved profile for one-click signing
- `RecordDetail.jsx` — Correctly checks for `sigProfile` before showing sign dialog; if none, shows `SignatureSetup` first

**What's broken**:
- **Zero SignatureProfile records exist** — No teacher or admin has configured their signature
- **Teacher Sarah Ahmed is SUSPENDED** (`status: 'suspended'`) — `recordWorkflow.js` rejects suspended users (line 43-44)
- **Student Ali Hassan is SUSPENDED** (`status: 'suspended'`) — Cannot submit records either

**Fix needed**: Un-suspend test users, then teacher/admin must complete SignatureSetup on first approval.

---

## 4. ADMIN APPROVAL QUEUE

**Page**: `pages/AdminApprovalQueue.jsx`  
**Status**: Working with one critical bug.

**What works**:
- Loads all records for the admin's `school_id` (school isolation enforced)
- Metric cards: Needs My Signature, With Teacher, Approved, Total Minted
- Filter tabs + search
- Record list with status badges, signature indicators, "Sign Now" buttons

**BUG — ProtectedRoute wrapping**:  
The export wraps everything in `<ProtectedRoute>` (line 255-261). This is the SAME PATTERN that caused the Profile blank page. If admin profile data isn't ready instantly, it redirects to `/Onboarding`. Same root cause as #1.

**Fix needed**: Remove `ProtectedRoute` wrapper from `AdminApprovalQueue`.

---

## 5. ADMIN SIGNATURE SETUP

Same issue as #3 — zero SignatureProfile records, no admin has configured their signature. The `RecordDetail.jsx` sign button correctly routes to `SignatureSetup` when `sigProfile` is null, so the flow works IF an admin with an active account tries to sign.

---

## 6. STUDENT GOOGLE DRIVE CONNECT

**Page**: `pages/StudentPortfolioVault.jsx`  
**Status**: UI is correct but never tested end-to-end.

**What works**:
- OAuth popup flow via `base44.connectors.connectAppUser('6a2967c08ac8557a7b3a1b2e')`
- Connection status detection by querying `DriveVault` entity
- Shows saved certificates with "Open in Drive" links
- Stats cards for Certificates Saved, Minted Records, Pending Approval

**What's not tested**:
- No student has actually connected their Drive (zero `DriveVault` entries)
- The "disconnect" flow calls `base44.connectors.disconnectAppUser()`

---

## 7. FINAL SAVE TO DRIVE

**Two backend functions serve different purposes**:

| Function | Route | Trigger |
|---|---|---|
| `mintAndArchive.js` | admin → shared Drive (builder's Google account) | Fallback when student Drive not connected |
| `saveToStudentDrive.js` | admin → student's personal Drive | Primary — uses `connectors.getAppUserConnection()` |
| `saveRecordToDrive.js` | OLD/WRONG route — requires `pending_drive_save` status | Unused in current flow |

**Verified in `mintAndArchive.js`**:
- Admin-only, school isolation, both signatures required ✅
- Creates folder: `BlockWard / School / Student / NFTs` ✅
- Uploads NFT Metadata JSON + Signed Certificate HTML ✅
- Status transition: `approved` → `minted` ✅

**Verified in `saveToStudentDrive.js`**:
- Admin-only, school isolation, both signatures required ✅
- Uses student's app-user OAuth connector token ✅
- Creates folder: `BlockWard / School / Student / Awards and Records / {Title}` ✅
- Create `DriveVault` entry for portfolio ✅
- Status transition: `approved` → `archived` ✅

**BUG — Dual status inconsistency**:  
`mintAndArchive` sets status to `minted`, `saveToStudentDrive` sets status to `archived`. The `StudentPortfolioVault` queries for `status: 'archived'`, so records saved via `mintAndArchive` (status: `minted`) won't appear in the student vault.

**Fix needed**: Both functions should set status to `archived`, or `StudentPortfolioVault` should query both statuses.

---

## 8. STUDENT PORTFOLIO VAULT

**Status**: UI correct, zero data to display.

**What works**:
- Connection status card with Connect/Disconnect
- Stats dashboard
- Certificate list with Drive links

**What's empty**:
- Zero `DriveVault` records exist (no records have been saved to student Drive)
- Zero `StudentRecord` with `status: 'archived'` exist

---

## 9. PERMISSIONS — Security Audit

### 9a. Teacher cannot mint directly ✅
`mintAndArchive.js` line 33: `if (profile.user_type !== 'admin') return 403`.

### 9b. Student cannot approve ✅
`recordWorkflow.js`: Only `teacher` role can call `teacherSignRecord`; only `admin` can call `adminSignRecord`. `RecordDetail.jsx` lines 188-197: `canAdminSign`/`canTeacherSign` gated by `profile.user_type`.

### 9c. Admin only sees own school ✅
All three backend functions (`recordWorkflow`, `mintAndArchive`, `saveToStudentDrive`) check `profile.school_id !== record.school_id` → 403. `AdminApprovalQueue` loads `StudentRecord.filter({ school_id: p.school_id })`.

### 9d. Student can only submit own records ✅
`recordWorkflow.js` line 76: `if (record.student_email !== user.email) return 403`.

### 9e. Student cannot sign as teacher/admin ✅
`recordWorkflow.js` line 63: role check enforced per action.

---

## 10. CRITICAL ISSUES SUMMARY

| # | Severity | Issue | Location |
|---|---|---|---|
| 1 | 🔴 HIGH | Teacher signature step skipped — existing record in wrong state | DB: record `6a2457527cb66d90d0f0650b` |
| 2 | 🔴 HIGH | Teacher Sarah Ahmed is SUSPENDED — cannot sign | DB: profile `6a2457407cb66d90d0f06507` |
| 3 | 🔴 HIGH | Student Ali Hassan is SUSPENDED — cannot submit | DB: profile `6a2457407cb66d90d0f06508` |
| 4 | 🔴 HIGH | AdminApprovalQueue wraps in ProtectedRoute — blank page risk | `pages/AdminApprovalQueue.jsx:255` |
| 5 | 🟡 MEDIUM | Zero SignatureProfile records — no one can sign | DB: SignatureProfile table |
| 6 | 🟡 MEDIUM | `minted` vs `archived` status mismatch | `mintAndArchive.js` vs `saveToStudentDrive.js` vs `StudentPortfolioVault` |
| 7 | 🟡 MEDIUM | `saveRecordToDrive.js` references unused status `pending_drive_save` | `functions/saveRecordToDrive.js` |
| 8 | 🟡 MEDIUM | `saveRecordToDrive.js` checks `student_signed` field that workflow never sets | `saveRecordToDrive.js:68` |
| 9 | 🟢 LOW | No DriveVault entries exist for portfolio testing | DB: DriveVault table |
| 10 | 🟢 LOW | No DigitalSignature records exist | DB: DigitalSignature table |

---

## 11. STATUS FLOW (DESIGNED)

```
draft ──[submitRecord/teacherSubmitRecord]──▶ awaiting_teacher_signature
                                                     │
                                                     ▼ [teacherSignRecord]
                                           awaiting_admin_signature
                                                     │
                                                     ▼ [adminSignRecord]
                                                  approved
                                                     │
                                ┌────────────────────┴────────────────────┐
                                ▼                                         ▼
                        [saveToStudentDrive]                     [mintAndArchive]
                        status: 'archived'                       status: 'minted'
                        (student's own Drive)                    (shared school Drive)
```

---

## 12. IMMEDIATE FIX PLAN

1. **Un-suspend** both test users (Sarah Ahmed + Ali Hassan)
2. **Delete** the broken record `6a2457527cb66d90d0f0650b` (skipped teacher signature)
3. **Remove ProtectedRoute** from `AdminApprovalQueue.jsx`
4. **Align statuses**: Both `mintAndArchive` and `saveToStudentDrive` should set `archived`
5. **Archive** `saveRecordToDrive.js` (references unused `pending_drive_save` status and `student_signed` field)
6. **Create test SignatureProfile** for both teacher and admin
7. **Run a fresh end-to-end test** through all 6 status transitions