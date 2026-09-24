# CHECKPOINT — Before Phase 7 (Administrator)

State at checkpoint (2026-09-24):

## Working end-to-end (tested in Phases 1–6)
- Auth/roles: provisionProfile, invites, join codes, StaffMembership approvals, admin_permissions matrix.
- Credentials: AchievementRequest flow (organisation + independent verification), sign-offs, delivery to vault, BlockWardVerificationRegistry, BW-HASH-V1 anchoring on Sepolia, correction/versioning, chainAnchor pending→anchoring lock.
- Classwork: Class/Assignment/Topic/Submission (private storage + signed URLs), extensions, resubmission windows, ClassCode expiring invites.
- Stream: scoped announcements (SCHOOL/YEAR/CLASS/TEAM/STUDENTS), pinned posts, comments + muting, scheduled announcements workflow.
- Gradebook: Assessment/StudentGrade/GradingScale/AcademicTerm, gradebookAction with GradeAudit, published-grade gating.
- Registers/seating: AttendanceSession/Record/AuditLog, SeatingPlan multi-layout, MIS disclaimers.
- Points: PointCategory/PointEntry, issuePoints, behaviour points staff-only, never public.
- Dashboards: student/teacher/admin widgets incl. work-to-mark, inbox, events, announcements; studentProgressData with teacher-class gating.
- Public: /@handle profiles, /portfolio, /verify/{id}, publicProfileData/getPublicPortfolio/publicVerify/publicOrgData — no points, no private data.
- Test Mode: test super user + personas (student/teacher/admin + demo cast), fixtures seeded.

## Recent fixes
- getAttendance teacher authorisation now mirrors saveAttendance (StaffMembership.class_ids OR teacher_email OR co_teachers).
- getDashboardData to_mark includes student_name fallback.

## Known issues carried forward
- Resource/TimetableEntry reads school-wide for members.
- issuePoints/getDashboardData teacher-class resolution not fully co-teacher-aware; issuePoints uses real caller, not Test Mode persona.
- Mobile rendering not device-verified.

## Entities (all with RLS)
School, SchoolCode, SchoolInvitation, ClassCode, Class, Enrollment, YearGroup, AcademicTerm, GradingScale, Assessment, StudentGrade, GradeAudit, Assignment, Topic, Submission, StreamComment, Announcement, AnnouncementReadReceipt, AttendanceSession, AttendanceRecord, AttendanceAuditLog, SeatingPlan, PointCategory, PointEntry, AwardTypes, AwardIssues, AchievementRequest, StudentRecord, DigitalSignature, SignatureProfile, BlockWard, BlockWardVerificationRegistry, VerificationEvent, UserProfile, StaffMembership, AdminSchoolMembership, DriveVault, Vaults, JoinRequest, Message, Notification, NotificationPreference, Event, Resource, TimetableEntry, Endorsement(+Invite/Term), Opportunity(+Application), TeamCredential, StudentOrgMembership, Follow, Reaction, ProfileView, SelfReportedAchievement, ContactMessage, AuditLog, DemoSeedRun.