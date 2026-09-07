import React from 'react';
import RoleGuard from '@/components/auth/RoleGuard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import SystemSettings from '@/pages/SystemSettings';
import AcademicSettings from '@/pages/AcademicSettings';
import PointCategories from '@/pages/PointCategories';
import SchoolCodes from '@/pages/SchoolCodes';
import AdminPermissions from '@/pages/AdminPermissions';
import { useSchool } from '@/lib/SchoolContext';

/**
 * SchoolSettings — the admin settings hub. Permission filtering now happens
 * at the tab level: the Permissions tab is only rendered for super admins
 * (or admins without a level, matching the previous Layout.jsx logic).
 */
export default function SchoolSettings() { return <RoleGuard roles={['admin']}><SchoolSettingsImpl /></RoleGuard>; }
function SchoolSettingsImpl() {
  const { profile } = useSchool();
  const isSuperAdmin = !profile?.admin_level || profile.admin_level === 'super_admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          General, academic, point categories, school codes and permissions
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="points">Point categories</TabsTrigger>
          <TabsTrigger value="codes">School codes</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="permissions">Permissions</TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="mt-6"><SystemSettings /></TabsContent>
        <TabsContent value="academic" className="mt-6"><AcademicSettings /></TabsContent>
        <TabsContent value="points" className="mt-6"><PointCategories /></TabsContent>
        <TabsContent value="codes" className="mt-6"><SchoolCodes /></TabsContent>
        {isSuperAdmin && (
          <TabsContent value="permissions" className="mt-6"><AdminPermissions /></TabsContent>
        )}
      </Tabs>
    </div>
  );
}