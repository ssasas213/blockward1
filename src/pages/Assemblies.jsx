import React from 'react';
import { useEffectiveRole } from '@/lib/useEffectiveRole';
import StudentAssemblies from '@/components/assemblies/StudentAssemblies';
import TeacherAdminAssemblies from '@/components/assemblies/TeacherAdminAssemblies';

export default function Assemblies() {
  const { effectiveRole } = useEffectiveRole();
  if (effectiveRole === 'student') return <StudentAssemblies />;
  return <TeacherAdminAssemblies isAdmin={effectiveRole === 'admin'} />;
}