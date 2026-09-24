import React from 'react';
import { useSchool } from '@/lib/SchoolContext';
import AppLoadingGate from '@/components/auth/AppLoadingGate';
import StudentGrades from '@/pages/StudentGrades';
import Gradebook from '@/pages/Gradebook';
import Records from '@/pages/Records';

/**
 * Grades — the one canonical grades page. A role-based view of one system:
 * students see their own published grades, teachers the class gradebook,
 * admins the records hub (which embeds grade management).
 * /Gradebook, /StudentGrades and /GradeManagement all redirect here.
 */
export default function Grades() {
  const { effectiveRole, loading } = useSchool();

  if (loading) return <AppLoadingGate message="Loading grades…" />;

  if (effectiveRole === 'student') return <StudentGrades />;
  if (effectiveRole === 'admin') return <Records />;
  return <Gradebook />;
}