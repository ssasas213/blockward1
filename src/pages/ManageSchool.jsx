import React from 'react';
import RoleGuard from '@/components/auth/RoleGuard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ManageUsers from '@/pages/ManageUsers';
import Invitations from '@/pages/Invitations';
import Classes from '@/pages/Classes';
import Announcements from '@/pages/Announcements';
import SchoolCalendar from '@/pages/SchoolCalendar';
import Assemblies from '@/pages/Assemblies';
import ManageOpportunities from '@/pages/ManageOpportunities';

/**
 * ManageSchool — the admin school hub. Each tab renders the existing page
 * unchanged; Assemblies is folded into the Calendar tab.
 */
export default function ManageSchool() { return <RoleGuard roles={['admin']}><ManageSchoolImpl /></RoleGuard>; }
function ManageSchoolImpl() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">School</h1>
        <p className="text-muted-foreground mt-1">
          People, invitations, classes, announcements, calendar and opportunities
        </p>
      </div>

      <Tabs defaultValue="people">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="mt-6"><ManageUsers /></TabsContent>
        <TabsContent value="invitations" className="mt-6"><Invitations /></TabsContent>
        <TabsContent value="classes" className="mt-6"><Classes /></TabsContent>
        <TabsContent value="announcements" className="mt-6"><Announcements /></TabsContent>
        <TabsContent value="calendar" className="mt-6 space-y-6">
          <SchoolCalendar />
          <Assemblies />
        </TabsContent>
        <TabsContent value="opportunities" className="mt-6"><ManageOpportunities /></TabsContent>
      </Tabs>
    </div>
  );
}