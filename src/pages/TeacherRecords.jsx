import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import RoleGuard from '@/components/auth/RoleGuard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import SubmissionsTab from '@/components/teacher/SubmissionsTab';
import IssuedTab from '@/components/teacher/IssuedTab';

/**
 * Achievements — the merged teacher achievement page.
 * My submissions (StudentRecords the teacher created or signed) and
 * Issued BlockWards (BlockWards queried by issuer_email) behind one route.
 */
export default function TeacherRecords() { return <RoleGuard roles={['teacher']}><TeacherRecordsImpl /></RoleGuard>; }
function TeacherRecordsImpl() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Achievements</h1>
          <p className="text-muted-foreground mt-1">
            Your submissions, sign-offs, and the BlockWards you've issued
          </p>
        </div>
        <Button
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          asChild
        >
          <Link to={createPageUrl('IssueBlockWard')}>
            <Plus className="h-4 w-4 mr-2" />
            Create achievement
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="submissions">
        <TabsList>
          <TabsTrigger value="submissions">My submissions</TabsTrigger>
          <TabsTrigger value="issued">Issued BlockWards</TabsTrigger>
        </TabsList>
        <TabsContent value="submissions" className="mt-6">
          <SubmissionsTab />
        </TabsContent>
        <TabsContent value="issued" className="mt-6">
          <IssuedTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}