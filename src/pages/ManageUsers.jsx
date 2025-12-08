import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, Search, Shield, GraduationCap, UserPlus,
  MoreVertical, Check, X, Edit, Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function ManageUsers() {
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
      const profiles = await base44.entities.UserProfile.list('-created_date');
      setUsers(profiles);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlockWardPermission = async (user) => {
    try {
      await base44.entities.UserProfile.update(user.id, {
        can_issue_blockwards: !user.can_issue_blockwards
      });
      loadUsers();
      toast.success(`BlockWard permission ${user.can_issue_blockwards ? 'revoked' : 'granted'}`);
    } catch (error) {
      toast.error('Failed to update permission');
    }
  };

  const handleUpdateStatus = async (user, status) => {
    try {
      await base44.entities.UserProfile.update(user.id, { status });
      loadUsers();
      toast.success(`User status updated to ${status}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      await base44.entities.UserProfile.update(selectedUser.id, {
        first_name: selectedUser.first_name,
        last_name: selectedUser.last_name,
        department: selectedUser.department,
        grade_level: selectedUser.grade_level,
        student_id: selectedUser.student_id
      });
      setShowEditDialog(false);
      loadUsers();
      toast.success('User updated successfully');
    } catch (error) {
      toast.error('Failed to update user');
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

  const getUserTypeBadge = (type) => {
    const colors = {
      admin: 'bg-rose-100 text-rose-700',
      teacher: 'bg-violet-100 text-violet-700',
      student: 'bg-blue-100 text-blue-700'
    };
    return colors[type] || 'bg-slate-100 text-slate-700';
  };

  const statusColors = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-slate-100 text-slate-700',
    suspended: 'bg-red-100 text-red-700'
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
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Manage Users</h1>
          <p className="text-slate-500 mt-1">Manage teachers, students, and permissions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Admins</p>
              <p className="text-2xl font-bold text-slate-900">{admins.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Teachers</p>
              <p className="text-2xl font-bold text-slate-900">{teachers.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Students</p>
              <p className="text-2xl font-bold text-slate-900">{students.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
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

      {/* Users Table */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>BlockWard Permission</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${getUserTypeBadge(user.user_type)}`}>
                        {user.first_name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium">{user.first_name} {user.last_name}</p>
                        <p className="text-xs text-slate-500">
                          {user.user_type === 'student' ? user.student_id : user.department}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500">{user.user_email}</TableCell>
                  <TableCell>
                    <Badge className={getUserTypeBadge(user.user_type)}>
                      {getUserTypeIcon(user.user_type)}
                      <span className="ml-1">{user.user_type}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[user.status] || statusColors.active}>
                      {user.status || 'active'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-slate-500">
                      {user.wallet_address?.slice(0, 6)}...{user.wallet_address?.slice(-4)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {user.user_type === 'teacher' && (
                      <Switch
                        checked={user.can_issue_blockwards}
                        onCheckedChange={() => handleToggleBlockWardPermission(user)}
                      />
                    )}
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

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={selectedUser.first_name}
                    onChange={(e) => setSelectedUser({ ...selectedUser, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={selectedUser.last_name}
                    onChange={(e) => setSelectedUser({ ...selectedUser, last_name: e.target.value })}
                  />
                </div>
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