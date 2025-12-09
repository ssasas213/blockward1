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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newUser, setNewUser] = useState({
    user_type: 'student',
    first_name: '',
    last_name: '',
    username: '',
    password: '',
    student_id: '',
    grade_level: '',
    department: ''
  });
  const [generatedCredentials, setGeneratedCredentials] = useState(null);

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
      const newValue = !user.can_issue_blockwards;
      await base44.entities.UserProfile.update(user.id, {
        can_issue_blockwards: newValue
      });
      loadUsers();
      toast.success(`BlockWard minting ${newValue ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating permission:', error);
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

  const generateCredentials = () => {
    const username = `${newUser.first_name.toLowerCase()}${newUser.last_name.toLowerCase()}`.replace(/\s/g, '');
    const password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    const studentId = newUser.user_type === 'student' ? `STU${Date.now().toString().slice(-6)}` : '';
    
    setNewUser({
      ...newUser,
      username,
      password,
      student_id: studentId || newUser.student_id
    });
  };

  const generateWallet = () => {
    const chars = '0123456789abcdef';
    let address = '0x';
    for (let i = 0; i < 40; i++) {
      address += chars[Math.floor(Math.random() * chars.length)];
    }
    return address;
  };

  const handleCreateUser = async () => {
    if (!newUser.first_name || !newUser.last_name || !newUser.username) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const currentUser = await base44.auth.me();
      const currentProfile = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      const school_id = currentProfile[0]?.school_id;

      const walletAddress = generateWallet();
      
      // Create fake email based on username for Base44 auth
      const userEmail = `${newUser.username}@${school_id || 'school'}.blockward.local`;

      const profileData = {
        user_email: userEmail,
        user_type: newUser.user_type,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        wallet_address: walletAddress,
        blockchain_role: newUser.user_type.toUpperCase(),
        status: 'active',
        school_id: school_id
      };

      if (newUser.user_type === 'student') {
        profileData.student_id = newUser.student_id;
        profileData.grade_level = newUser.grade_level;
        profileData.total_achievement_points = 0;
        profileData.total_behaviour_points = 0;
      } else if (newUser.user_type === 'teacher') {
        profileData.department = newUser.department;
        profileData.can_issue_blockwards = true;
      }

      await base44.entities.UserProfile.create(profileData);

      setGeneratedCredentials({
        username: newUser.username,
        password: newUser.password,
        student_id: newUser.student_id,
        name: `${newUser.first_name} ${newUser.last_name}`
      });

      toast.success('User created successfully');
      loadUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
    }
  };

  const resetCreateForm = () => {
    setNewUser({
      user_type: 'student',
      first_name: '',
      last_name: '',
      username: '',
      password: '',
      student_id: '',
      grade_level: '',
      department: ''
    });
    setGeneratedCredentials(null);
    setShowCreateDialog(false);
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
        <Button 
          onClick={() => setShowCreateDialog(true)}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Create User
        </Button>
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

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Create a new teacher or student account with credentials
            </DialogDescription>
          </DialogHeader>
          
          {!generatedCredentials ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>User Type</Label>
                <Select value={newUser.user_type} onValueChange={(value) => setNewUser({ ...newUser, user_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input
                    value={newUser.first_name}
                    onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input
                    value={newUser.last_name}
                    onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Username *</Label>
                  <Button variant="ghost" size="sm" onClick={generateCredentials}>
                    Generate Credentials
                  </Button>
                </div>
                <Input
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="johndoe"
                />
              </div>

              <div className="space-y-2">
                <Label>Password *</Label>
                <Input
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Enter password"
                  type="text"
                />
              </div>

              {newUser.user_type === 'student' && (
                <>
                  <div className="space-y-2">
                    <Label>Student ID</Label>
                    <Input
                      value={newUser.student_id}
                      onChange={(e) => setNewUser({ ...newUser, student_id: e.target.value })}
                      placeholder="STU001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Grade Level</Label>
                    <Input
                      value={newUser.grade_level}
                      onChange={(e) => setNewUser({ ...newUser, grade_level: e.target.value })}
                      placeholder="Year 9"
                    />
                  </div>
                </>
              )}

              {newUser.user_type === 'teacher' && (
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    value={newUser.department}
                    onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                    placeholder="Mathematics"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="py-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-2 text-green-700">
                  <Check className="h-5 w-5" />
                  <h3 className="font-semibold">User Created Successfully!</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-slate-500">Name</p>
                    <p className="font-medium text-slate-900">{generatedCredentials.name}</p>
                  </div>
                  {generatedCredentials.student_id && (
                    <div>
                      <p className="text-sm text-slate-500">Student ID</p>
                      <p className="font-medium text-slate-900">{generatedCredentials.student_id}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-slate-500">Username</p>
                    <p className="font-mono font-medium text-slate-900">{generatedCredentials.username}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Password</p>
                    <p className="font-mono font-medium text-slate-900">{generatedCredentials.password}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-green-200">
                  <p className="text-sm text-green-700">
                    ⚠️ Save these credentials! Share them with the user for login.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {!generatedCredentials ? (
              <>
                <Button variant="outline" onClick={resetCreateForm}>Cancel</Button>
                <Button onClick={handleCreateUser}>Create User</Button>
              </>
            ) : (
              <Button onClick={resetCreateForm}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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