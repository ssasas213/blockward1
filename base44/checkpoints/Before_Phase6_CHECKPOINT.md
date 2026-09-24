# Before Phase 6 — Teacher Dashboard, Registers, Seating and Points

Checkpoint created before Phase 6 work begins.

## Scope of Phase 6
- Teacher dashboard: today's classes, registers due, work to mark, achievement approvals, unread messages, events, announcements
- Seating plans: drag-and-drop, multiple saved layouts per class, student randomiser (verify existing)
- Registers: Present/Absent/Late/Excused, mark-all-present, correction history in audit log (verify existing)
- Clear "BlockWard classroom record — not official MIS attendance" labelling
- Points: achievement + private behaviour points via school-defined categories (verify existing)
- Student progress view for authorised teachers (grades, work, attendance, points, achievements)
- Mobile support throughout

## State at checkpoint
- Registers fully built: AttendanceRegister (keyboard-first, autosave, mark-all-present), AttendanceSession/AttendanceRecord/AttendanceAuditLog, saveAttendance/getAttendance with correction auditing (attendance_edited/admin_override entries)
- Seating fully built: SeatingPlanTab with multiple saved plans per class (PlanBar: create/duplicate/rename/default/delete), drag-and-drop (ClassroomCanvas), auto-arrange with Randomise + one-level undo (templates.js autoArrange), print/project views
- Points built: PointEntry/PointCategory entities, issuePoints (staff-only, school-scoped), IssuePoints (teacher UI), MyPoints (student), PointCategories (admin)
- Teacher dashboard exists with: today's schedule, TeacherRegisterStatusWidget (registers due), SignoffQueueWidget (achievement approvals), gradebook/assignments/assemblies widgets — but NO work-to-mark, unread-messages, events or announcements widgets
- StudentAttendance already labelled "read only… statutory register stays in its own system"
- No teacher-side student progress view exists
- getDashboardData is persona-aware (resolveEffectiveActor) and returns classes/schedule/points/total_students for the teacher role
- publicProfileData does NOT expose points of any kind; leaderboards use credentials/endorsements, not points
- Test fixtures: BlockWard Test School with test.teacher@blockward.test (teaches "Phase 5 Test Class" with test.student@blockward.test), point categories EMPTY

## Restore point
Revert files changed after this checkpoint to restore this state.