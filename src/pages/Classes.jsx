import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
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
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import {
  Plus, BookOpen, Users, Search, ChevronRight,
  Copy, Check, Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useEffectiveRole } from '@/lib/useEffectiveRole';

const CLASS_ACCENTS = [
  { bar: 'bg-primary', icon: 'from-primary/20 to-primary/5 text-primary' },
  { bar: 'bg-accent', icon: 'from-accent/20 to-accent/5 text-accent' },
  { bar: 'bg-accent-blue', icon: 'from-accent-blue/20 to-accent-blue/5 text-accent-blue' },
  { bar: 'bg-success', icon: 'from-success/20 to-success/5 text-success' },
  { bar: 'bg-warning', icon: 'from-warning/20 to-warning/5 text-warning' },
  { bar: 'bg-info', icon: 'from-info/20 to-info/5 text-info' },
];

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
    name: '', subject: '', description: '', room: '', grade_level: ''
  });
  const { effectiveRole, effectiveEmail } = useEffectiveRole();

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
      const schoolId = userProfile.school_id;

      if (effectiveRole === 'teacher') {
        const memberships = await base44.entities.StaffMembership.filter({ user_email: effectiveEmail });
        const membership = memberships[0];
        if (membership?.class_ids?.length > 0) {
          const allClasses = schoolId
            ? await base44.entities.Class.filter({ school_id: schoolId })
            : await base44.entities.Class.list();
          classData = allClasses.filter(c => membership.class_ids.includes(c.id));
        } else {
          classData = await base44.entities.Class.filter({ teacher_email: effectiveEmail });
        }
      } else if (effectiveRole === 'student') {
        const enrollments = await base44.entities.Enrollment.filter({ student_email: effectiveEmail, status: 'active' });
        if (enrollments.length > 0) {
          const classIds = enrollments.map(e => e.class_id);
          const allClasses = schoolId
            ? await base44.entities.Class.filter({ school_id: schoolId })
            : await base44.entities.Class.list();
          classData = allClasses.filter(c => classIds.includes(c.id));
        } else {
          const allClasses = schoolId
            ? await base44.entities.Class.filter({ school_id: schoolId })
            : await base44.entities.Class.list();
          classData = allClasses.filter(c => c.student_emails?.includes(effectiveEmail));
        }
      } else {
        classData = schoolId
          ? await base44.entities.Class.filter({ school_id: schoolId })
          : await base44.entities.Class.list();
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
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleCreateClass = async () => {
    if (!newClass.name || !user) return;
    setCreating(true);
    try {
      const classData = {
        ...newClass,
        teacher_email: effectiveEmail,
        join_code: generateJoinCode(),
        student_emails: [],
        status: 'active',
        school_id: profile?.school_id || null
      };
      const created = await base44.entities.Class.create(classData);

      try {
        const memberships = await base44.entities.StaffMembership.filter({ user_email: effectiveEmail });
        if (memberships.length > 0) {
          const membership = memberships[0];
          const updatedClassIds = [...(membership.class_ids || []), created.id];
          await base44.entities.StaffMembership.update(membership.id, { class_ids: updatedClassIds });
        } else if (profile?.school_id) {
          await base44.entities.StaffMembership.create({
            school_id: profile.school_id,
            user_email: user.email,
            role: 'TEACHER',
            class_ids: [created.id]
          });
        }
      } catch (membershipError) {
        console.warn('StaffMembership update failed (non-critical):', membershipError);
      }
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
      const res = await base44.functions.invoke('joinClassByCode', { code: joinCode.toUpperCase() });
      if (!res.data?.ok) {
        toast.error(res.data?.error || 'Failed to join class');
        setJoining(false);
        return;
      }

      setShowJoinDialog(false);
      setJoinCode('');
      await loadData();
      toast.success(`Successfully joined ${res.data.class?.name || 'the class'}!`);
    } catch (error) {
      console.error('Error joining class:', error);
      toast.error(error.response?.data?.error || error.message || 'Failed to join class');
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

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={effectiveRole === 'student' ? 'My Classes' : 'Classes'}
          description={effectiveRole === 'teacher' ? 'Manage your classes and students' : 'View your enrolled classes'}
        />
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={effectiveRole === 'student' ? 'My Classes' : 'Classes'}
        description={effectiveRole === 'teacher' ? 'Manage your classes and students' : 'View your enrolled classes'}
      >
        {effectiveRole === 'student' && (
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
                <Button variant="outline" onClick={() => setShowJoinDialog(false)}>Cancel</Button>
                <Button onClick={handleJoinClass} disabled={!joinCode || joining}>
                  {joining ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Joining...</>
                  ) : 'Join Class'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {(effectiveRole === 'teacher' || effectiveRole === 'admin') && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
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
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                <Button onClick={handleCreateClass} disabled={!newClass.name || creating}>
                  {creating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
                  ) : 'Create Class'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
          {filteredClasses.map((cls, i) => {
            const accent = CLASS_ACCENTS[i % CLASS_ACCENTS.length];
            return (
              <motion.div
                key={cls.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Card className="card-hover overflow-hidden cursor-pointer group">
                  <div className={`h-1.5 ${accent.bar}`} />
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${accent.icon} flex items-center justify-center shadow-sm`}>
                        <BookOpen className="h-7 w-7" />
                      </div>
                      {cls.join_code && effectiveRole === 'teacher' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            copyJoinCode(cls.join_code);
                          }}
                        >
                          {copiedCode === cls.join_code ? (
                            <Check className="h-4 w-4 text-success" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                          <span className="ml-1 font-mono text-sm">{cls.join_code}</span>
                        </Button>
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-1">{cls.name}</h3>
                    <p className="text-muted-foreground text-sm mb-4">{cls.subject || 'No subject specified'}</p>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span className="text-sm">{cls.student_emails?.length || 0} students</span>
                      </div>
                      {cls.room && (
                        <Badge variant="outline">Room {cls.room}</Badge>
                      )}
                    </div>

                    <Link to={createPageUrl(`ClassDetail?id=${cls.id}`)}>
                      <Button variant="outline" className="w-full">
                        View Class
                        <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No classes yet"
          description={effectiveRole === 'teacher' ? 'Create your first class to get started' : 'Join a class using a class code'}
        />
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