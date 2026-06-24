# BlockWard Achievement Lifecycle Architecture

## Overview

Every achievement in BlockWard has **ONE source of truth**: the `StudentRecord` entity.

A `StudentRecord` with `status: 'archived'` represents a fully approved achievement
(teacher-signed + admin-signed) with a BlockWard (NFT badge) minted.

All other entities (`BlockWard`, `DigitalSignature`, `AuditLog`, `Notification`,
`DriveVault`) are **derived projections** created atomically by the
`recordWorkflow` backend function when a record transitions to `'archived'`.

---

## Lifecycle

```
Achievement Created (StudentRecord, status: 'draft')
        │
        ▼
Teacher Signs (status: 'awaiting_admin_signature')
        │  ── creates DigitalSignature (teacher), AuditLog
        ▼
Admin Signs  (ATOMIC TRANSITION → status: 'archived')
        │
        ├─ 1. DigitalSignature (admin) created
        ├─ 2. BlockWard (NFT badge) created, linked via record_id
        ├─ 3. AuditLog entry written
        ├─ 4. StudentRecord updated → status: 'archived', verify_id set
        ├─ 5. Notification sent to student
        └─ 6. Student statistics updated (UserProfile)
        │
        ▼
   APPROVED & ARCHIVED  ← single source of truth
        │
        ▼
   (Optional) Google Drive backup via Portfolio Vault
```

### Status Values (Canonical)

| Status | Meaning |
|--------|---------|
| `draft` | Record created, not yet submitted |
| `awaiting_teacher_signature` | Submitted, awaiting teacher endorsement |
| `awaiting_admin_signature` | Teacher signed, awaiting admin approval |
| `archived` | **Fully approved** — teacher + admin signed, BlockWard minted |
| `rejected` | Rejected by teacher or admin (terminal) |

> **Note:** The statuses `approved`, `minted`, and `pending_student_drive` are
> **deprecated** and no longer produced by the workflow. They remain in the schema
> for backward compatibility but should not be used.

---

## Atomicity Guarantee

The `adminSignRecord` action in `recordWorkflow` is **atomic**:

1. Create admin `DigitalSignature` → if fails, return error (no state change)
2. Create `BlockWard` (linked via `record_id`) → if fails, rollback signature
3. Write `AuditLog` → if fails, rollback BlockWard + signature
4. Update `StudentRecord` → `status: 'archived'` → if fails, rollback all above
5. Send `Notification` (best-effort — a missed notification must not block an approval)
6. Update `UserProfile` statistics (best-effort)

**If any critical step (1–4) fails, the record remains in `awaiting_admin_signature`.**
No partial state is ever committed. The admin sees the error and can retry.

---

## Single Source of Truth — Reading

**All student-facing pages read earned achievements from `StudentRecord`
(status: 'archived') via `lib/achievementLifecycle.js`.**

| Page | Data Source | Loader |
|------|------------|--------|
| Student Dashboard | `loadEarnedAchievements()` | `lib/achievementLifecycle.js` |
| My BlockWards | `loadEarnedAchievements()` | `lib/achievementLifecycle.js` |
| My Achievements | `StudentRecord` (all statuses) | direct entity query |
| Portfolio Vault | `StudentRecord` (archived) + `loadEarnedAchievements()` | `lib/achievementLifecycle.js` |
| Record Detail | `StudentRecord` (by id) | direct entity query |
| Teacher Dashboard | `StudentRecord` (teacher's records) | direct entity query |
| Admin Dashboard | `StudentRecord` + `BlockWard` (counts) | direct entity query |
| Approval Queue | `StudentRecord` (by status) | direct entity query |

**No page queries the `BlockWard` entity directly as a source of truth.**
`BlockWard` is only joined (by `record_id`) for NFT-specific fields like
`token_id` and `transaction_hash`.

---

## Entity Relationships

```
StudentRecord (source of truth)
    │
    ├── 1:1 ── BlockWard (NFT projection, linked by record_id)
    ├── 1:N ── DigitalSignature (teacher + admin signatures)
    ├── 1:N ── AuditLog (full lifecycle trail)
    ├── 1:1 ── Notification (sent on approval)
    └── 1:N ── DriveVault (optional Google Drive backups)
```

---

## Consistency Rules

1. **A `StudentRecord` with `status: 'archived'` MUST have a corresponding
   `BlockWard`** (linked by `record_id`). The atomic workflow guarantees this.

2. **A `BlockWard` MUST have a corresponding `StudentRecord`** (linked by
   `record_id`). BlockWards are never created outside the workflow.

3. **`DigitalSignature` records are created only by the workflow** — never
   client-side. The `StudentMyRecords` page routes submissions through
   `recordWorkflow` to ensure signatures and audit logs are created server-side.

4. **`AuditLog` entries are created only by the workflow** — never client-side.

5. **Student statistics** (`UserProfile.total_achievement_points`) are updated
   by the workflow on approval, not by client-side code.

---

## Where Inconsistency Could Occur (and how it's prevented)

| Risk | Prevention |
|------|-----------|
| Record approved but no BlockWard | Atomic workflow — BlockWard created before status changes |
| BlockWard exists but record not archived | Atomic workflow — record status changes last |
| My BlockWards shows 0 when achievements exist | Pages read from StudentRecord (source of truth), not BlockWard |
| Notification sent but record missing | Notification created only after record is archived |
| Client-side audit log drift | Audit logs created only in `recordWorkflow` |
| Duplicate data sources across pages | All pages use `loadEarnedAchievements()` from `lib/achievementLifecycle.js` |