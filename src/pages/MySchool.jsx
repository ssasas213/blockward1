import React from 'react';
import RoleGuard from '@/components/auth/RoleGuard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Timetable from '@/pages/Timetable';
import StudentGrades from '@/pages/StudentGrades';
import Assignments from '@/pages/Assignments';
import StudentAttendance from '@/pages/StudentAttendance';
import MyPoints from '@/pages/MyPoints';
import Resources from '@/pages/Resources';
import Assemblies from '@/pages/Assemblies';
import SchoolCalendar from '@/pages/SchoolCalendar';

/**
 * MySchool — the merged student school hub. Each tab renders the existing page
 * component unchanged; Assemblies and the School Calendar are folded into the
 * Timetable tab as calendar entries.
 */
export default function MySchool() { return <RoleGuard roles={['student']}><MySchoolImpl /></RoleGuard>; }
function MySchoolImpl() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My School</h1>
        <p className="text-muted-foreground mt-1">
          Timetable, grades, assignments, attendance, points and resources
        </p>
      </div>

      <Tabs defaultValue="timetable">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
          <TabsTrigger value="grades">Grades</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="points">Points</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="timetable" className="mt-6 space-y-6">
          <Timetable />
          <Assemblies />
          <SchoolCalendar />
        </TabsContent>
        <TabsContent value="grades" className="mt-6"><StudentGrades /></TabsContent>
        <TabsContent value="assignments" className="mt-6"><Assignments /></TabsContent>
        <TabsContent value="attendance" className="mt-6"><StudentAttendance /></TabsContent>
        <TabsContent value="points" className="mt-6"><MyPoints /></TabsContent>
        <TabsContent value="resources" className="mt-6"><Resources /></TabsContent>
      </Tabs>
    </div>
  );
}