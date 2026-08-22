import React from 'react';
import { useEffectiveRole } from '@/lib/useEffectiveRole';
import StudentAssignments from '@/components/assignments/StudentAssignments';
import TeacherAssignments from '@/components/assignments/TeacherAssignments';
import AdminAssignments from '@/components/assignments/AdminAssignments';

export default function Assignments() {
  const { effectiveRole } = useEffectiveRole();
  if (effectiveRole === 'teacher') return <TeacherAssignments />;
  if (effectiveRole === 'admin') return <AdminAssignments />;
  return <StudentAssignments />;
}