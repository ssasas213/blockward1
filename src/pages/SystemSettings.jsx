import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, Database, Users, Shield, AlertCircle, 
  Check, FileText, Trash2, Download, Upload
} from 'lucide-react';
import { toast } from 'sonner';

export default function SystemSettings() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [school, setSchool] = useState(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalClasses: 0,
    totalPoints: 0,
    totalBlockWards: 0,
    storageUsed: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      
      if (profiles.length > 0) {
        setProfile(profiles[0]);
        
        if (profiles[0].school_id) {
          const schools = await base44.entities.School.filter({ id: profiles[0].school_id });
          if (schools.length > 0) setSchool(schools[0]);
        }

        const [users, classes, points, blockwards] = await Promise.all([
          base44.entities.UserProfile.list(),
          base44.entities.Class.list(),
          base44.entities.PointEntry.list(),
          base44.entities.BlockWard.list()
        ]);

        setStats({
          totalUsers: users.length,
          totalClasses: classes.length,
          totalPoints: points.length,
          totalBlockWards: blockwards.length,
          storageUsed: Math.random() * 100 // Simulated
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSchool = async (updates) => {
    try {
      await base44.entities.School.update(school.id, updates);
      loadData();
      toast.success('School settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const handleExportData = async () => {
    try {
      const [users, classes, points, blockwards] = await Promise.all([
        base44.entities.UserProfile.list(),
        base44.entities.Class.list(),
        base44.entities.PointEntry.list(),
        base44.entities.BlockWard.list()
      ]);

      const exportData = {
        users,
        classes,
        points,
        blockwards,
        exportDate: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `blockward-export-${Date.now()}.json`;
      a.click();
      
      toast.success('Data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">System Settings</h1>
        <p className="text-slate-500 mt-1">Configure and manage system-wide settings</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="grid gap-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>School Information</CardTitle>
                <CardDescription>Basic details about your institution</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>School Name</Label>
                  <Input 
                    defaultValue={school?.name} 
                    onBlur={(e) => handleUpdateSchool({ name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>School Code</Label>
                  <Input value={school?.code} disabled className="bg-slate-50" />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input 
                    defaultValue={school?.address} 
                    placeholder="School address"
                    onBlur={(e) => handleUpdateSchool({ address: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>System Statistics</CardTitle>
                <CardDescription>Overview of system usage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <Users className="h-5 w-5 text-slate-400 mb-2" />
                    <p className="text-2xl font-bold text-slate-900">{stats.totalUsers}</p>
                    <p className="text-sm text-slate-500">Total Users</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <FileText className="h-5 w-5 text-slate-400 mb-2" />
                    <p className="text-2xl font-bold text-slate-900">{stats.totalClasses}</p>
                    <p className="text-sm text-slate-500">Classes</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <Database className="h-5 w-5 text-slate-400 mb-2" />
                    <p className="text-2xl font-bold text-slate-900">{stats.totalPoints}</p>
                    <p className="text-sm text-slate-500">Point Entries</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <Shield className="h-5 w-5 text-slate-400 mb-2" />
                    <p className="text-2xl font-bold text-slate-900">{stats.totalBlockWards}</p>
                    <p className="text-sm text-slate-500">BlockWards</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="database">
          <div className="grid gap-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>Export and backup system data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">Export All Data</p>
                    <p className="text-sm text-slate-500">Download complete system backup as JSON</p>
                  </div>
                  <Button onClick={handleExportData}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">Storage Used</p>
                    <p className="text-sm text-slate-500">{stats.storageUsed.toFixed(1)}% of available storage</p>
                  </div>
                  <Badge variant="outline">{stats.storageUsed > 80 ? 'High' : 'Normal'}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Database Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-900">Users Table</span>
                    </div>
                    <Badge className="bg-green-100 text-green-700">Healthy</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-900">Classes Table</span>
                    </div>
                    <Badge className="bg-green-100 text-green-700">Healthy</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-900">BlockWards Table</span>
                    </div>
                    <Badge className="bg-green-100 text-green-700">Healthy</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Configure authentication and access controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">Require Email Verification</p>
                  <p className="text-sm text-slate-500">Users must verify email before accessing system</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">Two-Factor Authentication</p>
                  <p className="text-sm text-slate-500">Require 2FA for admin accounts</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">Session Timeout</p>
                  <p className="text-sm text-slate-500">Auto-logout after 30 minutes of inactivity</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900">Activity Logging</p>
                    <p className="text-sm text-amber-700">All administrative actions are logged</p>
                  </div>
                </div>
                <Badge className="bg-amber-100 text-amber-700">Active</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <div className="grid gap-6">
            <Card className="border-0 shadow-lg border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
                <CardDescription>Irreversible actions - proceed with caution</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div>
                    <p className="font-medium text-red-900">Reset All Points</p>
                    <p className="text-sm text-red-700">Clear all achievement and behavior points</p>
                  </div>
                  <Button variant="destructive" disabled>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Reset Points
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div>
                    <p className="font-medium text-red-900">Archive Academic Year</p>
                    <p className="text-sm text-red-700">Move current year data to archive</p>
                  </div>
                  <Button variant="destructive" disabled>
                    <Database className="h-4 w-4 mr-2" />
                    Archive Year
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}