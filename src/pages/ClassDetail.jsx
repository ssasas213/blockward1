import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Users, BookOpen, FileText, Award, ArrowLeft,
  Copy, Check, UserPlus, Trash2, Shield, Plus
} from 'lucide-react';
import { toast } from 'sonner';

export default function ClassDetail() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [resources, setResources] = useState([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const classId = urlParams.get('id');

  useEffect(() => {
    if (classId) loadData();
  }, [classId]);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      if (profiles.length > 0) setProfile(profiles[0]);

      const classes = await base44.entities.Class.filter({ id: classId });
      if (classes.length > 0) {
        const cls = classes[0];
        setClassData(cls);

        // Load student profiles
        if (cls.student_emails?.length > 0) {
          const allProfiles = await base44.entities.UserProfile.list();
          const studentProfiles = allProfiles.filter(p => 
            cls.student_emails.includes(p.user_email)
          );
          setStudents(studentProfiles);
        }

        // Load resources
        const classResources = await base44.entities.Resource.filter({ class_id: classId });
        setResources(classResources);
      }
    } catch (error) {
      console.error('Error loading class:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyJoinCode = () => {
    if (classData?.join_code) {
      navigator.clipboard.writeText(classData.join_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleAddStudent = async () => {
    if (!studentEmail) return;
    try {
      const updatedStudents = [...(classData.student_emails || []), studentEmail];
      await base44.entities.Class.update(classId, { student_emails: updatedStudents });
      setShowAddStudent(false);
      setStudentEmail('');
      loadData();
      toast.success('Student added successfully');
    } catch (error) {
      toast.error('Failed to add student');
    }
  };

  const handleRemoveStudent = async (email) => {
    try {
      const updatedStudents = classData.student_emails.filter(e => e !== email);
      await base44.entities.Class.update(classId, { student_emails: updatedStudents });
      loadData();
      toast.success('Student removed');
    } catch (error) {
      toast.error('Failed to remove student');
    }
  };

  const handleSendAnnouncement = async () => {
    if (!announcement.content) {
      toast.error('Please enter an announcement message');
      return;
    }

    try {
      const user = await base44.auth.me();
      await base44.entities.Message.create({
        school_id: classData.school_id,
        type: 'announcement',
        sender_email: user.email,
        sender_name: `${classData.teacher_email}`,
        sender_type: 'teacher',
        class_id: classId,
        class_name: classData.name,
        subject: announcement.subject || 'Class Announcement',
        content: announcement.content,
        read: false
      });

      setShowAnnouncementDialog(false);
      setAnnouncement({ subject: '', content: '' });
      loadClassData();
      toast.success('Announcement sent to all students');
    } catch (error) {
      toast.error('Failed to send announcement');
    }
  };

  const isTeacher = profile?.user_type === 'teacher' || profile?.user_type === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="text-center py-16">
        <BookOpen className="h-16 w-16 mx-auto text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Class not found</h2>
        <Link to={createPageUrl('Classes')}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Classes
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <Link to={createPageUrl('Classes')} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Classes
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">{classData.name}</h1>
          <p className="text-slate-500 mt-1">{classData.subject}</p>
        </div>
        {isTeacher && (
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={copyJoinCode}>
              {copiedCode ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <Copy className="h-4 w-4 mr-2" />}
              {classData.join_code}
            </Button>
            <Button className="bg-gradient-to-r from-violet-600 to-indigo-600" asChild>
              <Link to={createPageUrl(`IssuePoints?class=${classId}`)}>
                <Award className="h-4 w-4 mr-2" />
                Issue Points
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Students</p>
              <p className="text-2xl font-bold text-slate-900">{students.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Resources</p>
              <p className="text-2xl font-bold text-slate-900">{resources.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Room</p>
              <p className="text-2xl font-bold text-slate-900">{classData.room || 'TBA'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="students" className="space-y-6">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Class Students</CardTitle>
              {isTeacher && (
                <Button variant="outline" size="sm" onClick={() => setShowAddStudent(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Student
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {students.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Points</TableHead>
                      {isTeacher && <TableHead className="w-20"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          {student.first_name} {student.last_name}
                        </TableCell>
                        <TableCell className="text-slate-500">{student.user_email}</TableCell>
                        <TableCell>{student.student_id || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-700">+{student.total_achievement_points || 0}</Badge>
                            <Badge variant="outline" className="text-red-600">-{student.total_behaviour_points || 0}</Badge>
                          </div>
                        </TableCell>
                        {isTeacher && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveStudent(student.user_email)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No students enrolled yet</p>
                  {isTeacher && (
                    <p className="text-sm mt-2">Share the join code: <span className="font-mono font-bold">{classData.join_code}</span></p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="announcements">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Class Announcements</CardTitle>
            </CardHeader>
            <CardContent>
              {announcements.length > 0 ? (
                <div className="space-y-4">
                  {announcements.map((ann) => (
                    <div key={ann.id} className="p-4 bg-violet-50 border border-violet-200 rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Megaphone className="h-4 w-4 text-violet-600" />
                            <h4 className="font-semibold text-slate-900">{ann.subject}</h4>
                          </div>
                          <p className="text-slate-700 whitespace-pre-wrap mb-2">{ann.content}</p>
                          <p className="text-xs text-slate-500">
                            Posted by {ann.sender_name} on {format(new Date(ann.created_date), 'PPp')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No announcements yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources">
          <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Class Resources</CardTitle>
              {isTeacher && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={createPageUrl(`Resources?class=${classId}`)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Resource
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {resources.length > 0 ? (
                <div className="space-y-3">
                  {resources.map((resource) => (
                    <a
                      key={resource.id}
                      href={resource.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                      <div className="h-12 w-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{resource.title}</p>
                        <p className="text-sm text-slate-500">{resource.description || resource.file_type}</p>
                      </div>
                      <Badge variant="outline">{resource.file_type}</Badge>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No resources uploaded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Student Dialog */}
      <Dialog open={showAddStudent} onOpenChange={setShowAddStudent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>
              Enter the student's email address to add them to this class
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="student@email.com"
              type="email"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStudent(false)}>Cancel</Button>
            <Button onClick={handleAddStudent} disabled={!studentEmail}>Add Student</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}