import React from 'react';
import RoleGuard from '@/components/auth/RoleGuard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AllRecordsTab from '@/components/records/AllRecordsTab';
import GradeManagement from '@/pages/GradeManagement';

/**
 * Records — the admin records hub: All records (StudentRecord by school_id)
 * and Grade management, behind one tabbed route.
 */
export default function Records() { return <RoleGuard roles={['admin']}><RecordsImpl /></RoleGuard>; }
function RecordsImpl() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Records</h1>
        <p className="text-muted-foreground mt-1">
          Every student achievement record — review, sign, deliver, verify, and manage grades
        </p>
      </div>

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">All records</TabsTrigger>
          <TabsTrigger value="grades">Grade management</TabsTrigger>
        </TabsList>
        <TabsContent value="records" className="mt-6">
          <AllRecordsTab />
        </TabsContent>
        <TabsContent value="grades" className="mt-6">
          <GradeManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}