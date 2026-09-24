# Before Phase 5 — Classroom, Work and Communication

Checkpoint created before Phase 5 work begins.

## Scope of Phase 5
- Expiring, revocable class codes / links / QR invitations
- Draft & scheduled assignments (verify existing), review of submitted/late/missing work
- Feedback, grades, extensions, controlled resubmissions
- Gradebook draft/published grades with AuditLog history
- Announcement permission gating (class vs year-group/school)
- Student dashboard: next lesson, deadlines, recent feedback, announcements
- Messaging authorization (student↔staff, teacher↔parent) without exposing contact details
- Private file storage + permission-checked signed URLs for submissions

## State at checkpoint
- Classwork system (Assignment/Submission/Topic/StreamComment + classworkAction/submissionAction) already exists
- Gradebook (gradebookAction, Gradebook.jsx, StudentGrades.jsx) exists
- Messages (sendMessage/getMessages/DirectMessages) exist
- Timetable (TimetableEntry, Timetable.jsx) and SchoolCalendar exist
- Class.join_code is a single non-expiring string — no revocation/expiry yet
- Submissions/evidence currently uploaded to PUBLIC storage (UploadPublicFile)

## Restore point
Revert files changed after this checkpoint to restore this state.