import React from 'react';
import RoleGuard from '@/components/auth/RoleGuard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Analytics from '@/pages/Analytics';
import AdminAttendance from '@/pages/AdminAttendance';
import Reports from '@/pages/Reports';

/**
 * Insights — the admin insights hub: Analytics, school-wide Attendance and
 * Reports, each rendered unchanged.
 */
export default function Insights() { return <RoleGuard roles={['admin']}><InsightsImpl /></RoleGuard>; }
function InsightsImpl() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Insights</h1>
        <p className="text-muted-foreground mt-1">Analytics, school-wide attendance and reports</p>
      </div>

      <Tabs defaultValue="analytics">
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-6"><Analytics /></TabsContent>
        <TabsContent value="attendance" className="mt-6"><AdminAttendance /></TabsContent>
        <TabsContent value="reports" className="mt-6"><Reports /></TabsContent>
      </Tabs>
    </div>
  );
}