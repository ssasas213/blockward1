import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, BookOpen, Users, Search, ChevronRight,
  Copy, Check, Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

function ClassesContent() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [newClass, setNewClass] = useState({
    name: '',
    subject: '',
    description: '',
    room: '',
    grade_level: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (!currentUser) return;

      const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      const userProfile = profiles.length > 0 ? profiles[0] : null;
      setProfile(userProfile);

      if (!userProfile) return;

      let classData = [];
      if (userProfile.user_type === 'teacher') {
        classData = await base44.entities.Class.filter({ teacher_email: currentUser.email });
      } else if (userProfile.user_type === 'student') {
        const allClasses = await base44.entities.Class.list();
        classData = allClasses.filter(c => c.student_emails?.includes(currentUser.email));
      } else {
        classData = await base44.entities.Class.list();
      }
      setClasses(classData);
    } catch (error) {
      console.error('Error loading classes:', error);
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const generateJoinCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const handleCreateClass = async () => {
    if (!newClass.name || !user) return;
    setCreating(true);
    try {
      const classData = {
        ...newClass,
        teacher_email: user.email,
        join_code: generateJoinCode(),
        student_emails: [],
        status: 'active'
      };
      if (profile?.school_id) {
        classData.school_id = profile.school_id;
      }
      await base44.entities.Class.create(classData);
      setShowCreateDialog(false);
      setNewClass({ name: '', subject: '', description: '', room: '', grade_level: '' });
      await loadData();
      toast.success('Class created successfully!');
    } catch (error) {
      console.error('Error creating class:', error);
      toast.error('Failed to create class');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinClass = async () => {
    if (!joinCode || !user) return;
    setJoining(true);
    try {
      const allClasses = await base44.entities.Class.list();
      const classToJoin = allClasses.find(c => c.join_code?.toUpperCase() === joinCode.toUpperCase());
      
      if (!classToJoin) {
        toast.error('Invalid class code');
        setJoining(false);
        return;
      }

      if (classToJoin.student_emails?.includes(user.email)) {
        toast.error('You are already in this class');
        setJoining(false);
        return;
      }

      const updatedStudents = [...(classToJoin.student_emails || []), user.email];
      await base44.entities.Class.update(classToJoin.id, { student_emails: updatedStudents });
      
      setShowJoinDialog(false);
      setJoinCode('');
      await loadData();
      toast.success(`Successfully joined ${classToJoin.name}!`);
    } catch (error) {
      console.error('Error joining class:', error);
      toast.error('Failed to join class');
    } finally {
      setJoining(false);
    }
  };

  const copyJoinCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Class code copied');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredClasses = classes.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.subject?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const classColors = [
    'from-violet-500 to-purple-500',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-green-500',
    'from-rose-500 to-pink-500',
    'from-amber-500 to-orange-500',
    'from-indigo-500 to-blue-500'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {profile?.user_type === 'student' ? 'My Classes' : 'Classes'}
          </h1>
          <p className="text-slate-500 mt-1">
            {profile?.user_type === 'teacher' 
              ? 'Manage your classes and students' 
              : 'View your enrolled classes'}
          </p>
        </div>
        <div className="flex gap-3">
          {profile?.user_type === 'student' && (
            <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Join Class
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Join a Class</DialogTitle>
                  <DialogDescription>
                    Enter the class code provided by your teacher
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Class Code</Label>
                    <Input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      className="text-center text-2xl tracking-widest font-mono"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowJoinDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleJoinClass} 
                    disabled={!joinCode || joining}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 transition-all duration-200 active:scale-95"
                  >
                    {joining ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      'Join Class'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {(profile?.user_type === 'teacher' || profile?.user_type === 'admin') && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Class
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Class</DialogTitle>
                  <DialogDescription>
                    Set up a new class for your students
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Class Name *</Label>
                    <Input
                      value={newClass.name}
                      onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                      placeholder="e.g. Year 9 Mathematics - Set A"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input
                      value={newClass.subject}
                      onChange={(e) => setNewClass({ ...newClass, subject: e.target.value })}
                      placeholder="e.g. Mathematics"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Room</Label>
                      <Input
                        value={newClass.room}
                        onChange={(e) => setNewClass({ ...newClass, room: e.target.value })}
                        placeholder="e.g. A101"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Year/Grade</Label>
                      <Input
                        value={newClass.grade_level}
                        onChange={(e) => setNewClass({ ...newClass, grade_level: e.target.value })}
                        placeholder="e.g. Year 9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newClass.description}
                      onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                      placeholder="Brief description of the class..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateClass} 
                    disabled={!newClass.name || creating}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 transition-all duration-200 active:scale-95"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Class'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search classes..."
          className="pl-10"
        />
      </div>

      {/* Classes Grid */}
      {filteredClasses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClasses.map((cls, i) => (
            <motion.div
              key={cls.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer">
                <div className={`h-2 bg-gradient-to-r ${classColors[i % classColors.length]}`} />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${classColors[i % classColors.length]} flex items-center justify-center shadow-lg`}>
                      <BookOpen className="h-7 w-7 text-white" />
                    </div>
                    {cls.join_code && profile?.user_type === 'teacher' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          copyJoinCode(cls.join_code);
                        }}
                        className="text-slate-500 hover:text-slate-900 transition-all duration-200 active:scale-95"
                      >
                        {copiedCode === cls.join_code ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        <span className="ml-1 font-mono text-sm">{cls.join_code}</span>
                      </Button>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">{cls.name}</h3>
                  <p className="text-slate-500 text-sm mb-4">{cls.subject || 'No subject specified'}</p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">{cls.student_emails?.length || 0} students</span>
                    </div>
                    {cls.room && (
                      <Badge variant="outline">Room {cls.room}</Badge>
                    )}
                  </div>

                  <Link to={createPageUrl(`ClassDetail?id=${cls.id}`)}>
                    <Button variant="outline" className="w-full group-hover:bg-slate-100 transition-all duration-200 active:scale-95">
                      View Class
                      <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="border-0 shadow-lg">
          <CardContent className="text-center py-16">
            <BookOpen className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No classes yet</h3>
            <p className="text-slate-500 mb-6">
              {profile?.user_type === 'teacher' 
                ? 'Create your first class to get started' 
                : 'Join a class using a class code'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Classes() {
  return (
    <ProtectedRoute>
      <ClassesContent />
    </ProtectedRoute>
  );
}