import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/ui/stat-card';
import EmptyState from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { Users, Search, Shield, GraduationCap, MoreVertical, Check, X, Edit, Send } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';

import RoleGuard from '@/components/auth/RoleGuard';
export default function ManageUsers() { return <RoleGuard roles={['admin']}><ManageUsersImpl/></RoleGuard>; }
function ManageUsersImpl() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const currentUser = await base44.auth.me();
      const currentProfiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      const currentProfile = currentProfiles[0];
      const schoolId = currentProfile?.school_id;

      const profiles = schoolId
        ? await base44.entities.UserProfile.filter({ school_id: schoolId }, '-created_date')
        : await base44.entities.UserProfile.list('-created_date');
      setUsers(profiles);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (user, status) => {
    try {
      const res = await base44.functions.invoke('adminUpdateUser', { target_email: user.user_email, updates: { status } });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      loadUsers();
      toast.success(`User status updated to ${status}`);
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      const original = users.find(u => u.id === selectedUser.id);
      if (original?.user_type !== selectedUser.user_type) {
        const roleRes = await base44.functions.invoke('changeUserRole', { target_email: selectedUser.user_email, new_role: selectedUser.user_type });
        const roleData = roleRes.data || roleRes;
        if (roleData?.error) throw new Error(roleData.error);
      }
      const updateRes = await base44.functions.invoke('adminUpdateUser', {
        target_email: selectedUser.user_email,
        updates: {
          first_name: selectedUser.first_name,
          last_name: selectedUser.last_name,
          department: selectedUser.department,
          grade_level: selectedUser.grade_level,
          student_id: selectedUser.student_id,
        },
      });
      const updateData = updateRes.data || updateRes;
      if (updateData?.error) throw new Error(updateData.error);
      setShowEditDialog(false);
      loadUsers();
      toast.success('User updated successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to update user');
    }
  };

  const getUserTypeIcon = (type) => {
    switch (type) {
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'teacher': return <Users className="h-4 w-4" />;
      case 'student': return <GraduationCap className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const roleBadgeVariant = (type) => {
    switch (type) {
      case 'admin': return 'destructive';
      case 'teacher': return 'default';
      case 'student': return 'info';
      default: return 'secondary';
    }
  };

  const statusBadgeVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'suspended': return 'destructive';
      case 'inactive': return 'secondary';
      default: return 'success';
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.user_email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || u.user_type === filterType;
    return matchesSearch && matchesType;
  });

  const teachers = users.filter(u => u.user_type === 'teacher');
  const students = users.filter(u => u.user_type === 'student');
  const admins = users.filter(u => u.user_type === 'admin');

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Manage Users" description="View, edit role, and suspend users" />
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Manage Users" description="View, edit role, and suspend users">
        <Button asChild>
          <Link to={createPageUrl('Invitations')}>
            <Send className="h-4 w-4 mr-2" />
            Invite People
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Admins" value={admins.length} icon={Shield} accentColor="destructive" />
        <StatCard label="Teachers" value={teachers.length} icon={Users} accentColor="primary" />
        <StatCard label="Students" value={students.length} icon={GraduationCap} accentColor="blue" />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users..."
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
            <SelectItem value="teacher">Teachers</SelectItem>
            <SelectItem value="student">Students</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredUsers.length === 0 ? (
        <EmptyState icon={Users} title="No users found" description="Try adjusting your search or filters, or invite people to join." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border border-border flex items-center justify-center text-sm font-medium text-primary">
                          {user.first_name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{user.first_name} {user.last_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.user_type === 'student' ? user.student_id : user.department}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.user_email}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant(user.user_type)}>
                        {getUserTypeIcon(user.user_type)}
                        <span className="ml-1 capitalize">{user.user_type}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(user.status)}>
                        {user.status || 'active'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedUser(user); setShowEditDialog(true); }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(user, user.status === 'active' ? 'suspended' : 'active')}>
                            {user.status === 'active' ? (
                              <><X className="h-4 w-4 mr-2" />Suspend</>
                            ) : (
                              <><Check className="h-4 w-4 mr-2" />Activate</>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update role and profile information</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={selectedUser.first_name || ''}
                    onChange={(e) => setSelectedUser({ ...selectedUser, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={selectedUser.last_name || ''}
                    onChange={(e) => setSelectedUser({ ...selectedUser, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={selectedUser.user_type}
                  onValueChange={(value) => setSelectedUser({ ...selectedUser, user_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedUser.user_type === 'teacher' && (
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    value={selectedUser.department || ''}
                    onChange={(e) => setSelectedUser({ ...selectedUser, department: e.target.value })}
                  />
                </div>
              )}
              {selectedUser.user_type === 'student' && (
                <>
                  <div className="space-y-2">
                    <Label>Student ID</Label>
                    <Input
                      value={selectedUser.student_id || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, student_id: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Grade Level</Label>
                    <Input
                      value={selectedUser.grade_level || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, grade_level: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateUser}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}