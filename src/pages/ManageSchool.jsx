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
import AdminCredentials from '@/pages/AdminCredentials';

/**
 * ManageSchool — the admin school hub. Each tab renders the existing page
 * unchanged; Assemblies is folded into the Calendar tab.
 */
export default function ManageSchool() { return <RoleGuard roles={['admin']}><ManageSchoolImpl /></RoleGuard>; }
function ManageSchoolImpl() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">School</h1>
        <p className="text-muted-foreground mt-1">
          People, invitations, classes, announcements, calendar and opportunities
        </p>
      </div>

      {/* Deep-linkable tab (?tab=credentials) — the dashboard's "View
          register" link lands directly on the credential register. */}
      <Tabs defaultValue={(() => {
        try {
          const t = new URLSearchParams(window.location.search).get('tab');
          return ['people', 'invitations', 'classes', 'credentials', 'announcements', 'calendar', 'opportunities'].includes(t) ? t : 'people';
        } catch { return 'people'; }
      })()}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="mt-6"><ManageUsers /></TabsContent>
        <TabsContent value="invitations" className="mt-6"><Invitations /></TabsContent>
        <TabsContent value="classes" className="mt-6"><Classes /></TabsContent>
        <TabsContent value="credentials" className="mt-6"><AdminCredentials /></TabsContent>
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