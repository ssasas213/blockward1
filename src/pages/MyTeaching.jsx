import React from 'react';
import RoleGuard from '@/components/auth/RoleGuard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Classes from '@/pages/Classes';
import Timetable from '@/pages/Timetable';
import Attendance from '@/pages/Attendance';
import Gradebook from '@/pages/Gradebook';
import Assignments from '@/pages/Assignments';
import IssuePoints from '@/pages/IssuePoints';
import Resources from '@/pages/Resources';
import Assemblies from '@/pages/Assemblies';
import SchoolCalendar from '@/pages/SchoolCalendar';

/**
 * MyTeaching — the merged teaching hub. Each tab renders the existing page
 * component unchanged; Assemblies and the School Calendar are folded into
 * the Timetable tab as calendar entries.
 */
export default function MyTeaching() { return <RoleGuard roles={['teacher']}><MyTeachingImpl /></RoleGuard>; }
function MyTeachingImpl() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Teaching</h1>
        <p className="text-muted-foreground mt-1">
          Classes, timetable, attendance, gradebook, assignments, points and resources
        </p>
      </div>

      <Tabs defaultValue="classes">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="gradebook">Gradebook</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="points">Points</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="mt-6"><Classes /></TabsContent>

        <TabsContent value="timetable" className="mt-6 space-y-6">
          <Timetable />
          <Assemblies />
          <SchoolCalendar />
        </TabsContent>

        <TabsContent value="attendance" className="mt-6"><Attendance /></TabsContent>
        <TabsContent value="gradebook" className="mt-6"><Gradebook /></TabsContent>
        <TabsContent value="assignments" className="mt-6"><Assignments /></TabsContent>
        <TabsContent value="points" className="mt-6"><IssuePoints /></TabsContent>
        <TabsContent value="resources" className="mt-6"><Resources /></TabsContent>
      </Tabs>
    </div>
  );
}