import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Edit, Search, Users, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPermissions() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editDialog, setEditDialog] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [editForm, setEditForm] = useState({
    admin_level: '',
    admin_permissions: {}
  });

  const adminLevels = [
    { value: 'super_admin', label: 'Super Admin', desc: 'Full access to all features' },
    { value: 'head_of_year', label: 'Head of Year', desc: 'Manage year-level students and data' },
    { value: 'head_of_department', label: 'Head of Department', desc: 'Manage department staff and classes' },
    { value: 'data_manager', label: 'Data Manager', desc: 'View reports and analytics only' },
    { value: 'basic_admin', label: 'Basic Admin', desc: 'Limited administrative access' }
  ];

  const permissionsList = [
    { key: 'manage_users', label: 'Manage Users', desc: 'Create, edit, and suspend users' },
    { key: 'manage_classes', label: 'Manage Classes', desc: 'Create and configure classes' },
    { key: 'issue_blockwards', label: 'Issue BlockWards', desc: 'Mint achievement NFTs' },
    { key: 'view_all_points', label: 'View All Points', desc: 'See all student point data' },
    { key: 'edit_points', label: 'Edit Points', desc: 'Modify and delete point entries' },
    { key: 'view_reports', label: 'View Reports', desc: 'Access analytics and reports' },
    { key: 'manage_categories', label: 'Manage Categories', desc: 'Edit point categories' },
    { key: 'manage_school_settings', label: 'Manage School', desc: 'Edit school settings and codes' },
    { key: 'view_parent_contacts', label: 'Parent Contacts', desc: 'Access parent information' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      
      if (profiles.length > 0) {
        setProfile(profiles[0]);
        
        // Only super admins can manage permissions
        if (profiles[0].admin_level !== 'super_admin' && profiles[0].user_type === 'admin') {
          toast.error('Only Super Admins can manage permissions');
          return;
        }

        const adminUsers = await base44.entities.UserProfile.filter({ user_type: 'admin' });
        setAdmins(adminUsers);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditAdmin = (admin) => {
    setSelectedAdmin(admin);
    setEditForm({
      admin_level: admin.admin_level || 'basic_admin',
      admin_permissions: admin.admin_permissions || {}
    });
    setEditDialog(true);
  };

  const applyPresetPermissions = (level) => {
    const presets = {
      super_admin: {
        manage_users: true,
        manage_classes: true,
        issue_blockwards: true,
        view_all_points: true,
        edit_points: true,
        view_reports: true,
        manage_categories: true,
        manage_school_settings: true,
        view_parent_contacts: true
      },
      head_of_year: {
        manage_users: false,
        manage_classes: true,
        issue_blockwards: true,
        view_all_points: true,
        edit_points: true,
        view_reports: true,
        manage_categories: false,
        manage_school_settings: false,
        view_parent_contacts: true
      },
      head_of_department: {
        manage_users: false,
        manage_classes: true,
        issue_blockwards: true,
        view_all_points: true,
        edit_points: false,
        view_reports: true,
        manage_categories: false,
        manage_school_settings: false,
        view_parent_contacts: true
      },
      data_manager: {
        manage_users: false,
        manage_classes: false,
        issue_blockwards: false,
        view_all_points: true,
        edit_points: false,
        view_reports: true,
        manage_categories: false,
        manage_school_settings: false,
        view_parent_contacts: false
      },
      basic_admin: {
        manage_users: false,
        manage_classes: false,
        issue_blockwards: false,
        view_all_points: false,
        edit_points: false,
        view_reports: false,
        manage_categories: false,
        manage_school_settings: false,
        view_parent_contacts: false
      }
    };

    setEditForm({
      ...editForm,
      admin_level: level,
      admin_permissions: presets[level] || {}
    });
  };

  const handleSavePermissions = async () => {
    try {
      await base44.entities.UserProfile.update(selectedAdmin.id, {
        admin_level: editForm.admin_level,
        admin_permissions: editForm.admin_permissions
      });
      
      toast.success('Permissions updated');
      setEditDialog(false);
      loadData();
    } catch (error) {
      toast.error('Failed to update permissions');
    }
  };

  const togglePermission = (key) => {
    setEditForm({
      ...editForm,
      admin_permissions: {
        ...editForm.admin_permissions,
        [key]: !editForm.admin_permissions[key]
      }
    });
  };

  const filteredAdmins = admins.filter(admin =>
    `${admin.first_name} ${admin.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.user_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (profile?.user_type !== 'admin' || (profile?.admin_level !== 'super_admin' && profile?.admin_level)) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="text-center py-16">
          <Lock className="h-16 w-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h3>
          <p className="text-slate-500">Only Super Admins can manage permissions</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Permissions</h1>
          <p className="text-slate-500 mt-1">Manage access levels and permissions for administrators</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search administrators..."
          className="pl-10"
        />
      </div>

      {/* Admin List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAdmins.map((admin) => {
          const level = adminLevels.find(l => l.value === admin.admin_level);
          const permCount = Object.values(admin.admin_permissions || {}).filter(Boolean).length;
          
          return (
            <Card key={admin.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                      {admin.first_name?.[0]}{admin.last_name?.[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {admin.first_name} {admin.last_name}
                      </h3>
                      <p className="text-sm text-slate-500">{admin.user_email}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Badge variant="outline" className="mb-2">
                    {level?.label || 'Basic Admin'}
                  </Badge>
                  <p className="text-xs text-slate-500">{level?.desc || 'No specific level assigned'}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-slate-600">{permCount} permissions</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditAdmin(admin)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Admin Permissions</DialogTitle>
            <DialogDescription>
              Configure access level and specific permissions for {selectedAdmin?.first_name} {selectedAdmin?.last_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Admin Level</Label>
              <Select
                value={editForm.admin_level}
                onValueChange={(value) => applyPresetPermissions(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select admin level" />
                </SelectTrigger>
                <SelectContent>
                  {adminLevels.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      <div>
                        <div className="font-medium">{level.label}</div>
                        <div className="text-xs text-slate-500">{level.desc}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Specific Permissions</Label>
              <div className="space-y-3">
                {permissionsList.map((perm) => (
                  <div key={perm.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900">{perm.label}</p>
                      <p className="text-sm text-slate-500">{perm.desc}</p>
                    </div>
                    <Switch
                      checked={editForm.admin_permissions[perm.key] || false}
                      onCheckedChange={() => togglePermission(perm.key)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} className="bg-gradient-to-r from-violet-600 to-indigo-600">
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}