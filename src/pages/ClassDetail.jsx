import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Users, BookOpen, FileText, Award, ArrowLeft,
  Copy, Check, UserPlus, Trash2, Shield, Sparkles, GraduationCap, ClipboardList, MessageSquare, BarChart3, DoorOpen, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '@/lib/SchoolContext';
import SeatingPlanTab from '@/components/seating/SeatingPlanTab';
import StreamTab from '@/components/stream/StreamTab';
import ClassworkTab from '@/components/classwork/ClassworkTab';
import GradesTab from '@/components/classwork/GradesTab';

export default function ClassDetail() {
  const [loading, setLoading] = useState(true);
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [resources, setResources] = useState([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');

  const { profile } = useSchool();

  const urlParams = new URLSearchParams(window.location.search);
  const classId = urlParams.get('id');

  useEffect(() => {
    if (classId) loadData();
  }, [classId]);

  const loadData = async () => {
    try {
      const classes = await base44.entities.Class.filter({ id: classId });
      if (classes.length > 0) {
        const cls = classes[0];
        setClassData(cls);

        // People: teacher + co-teachers + enrolled student profiles.
        const teacherEmails = [cls.teacher_email, ...(cls.co_teachers || [])].filter(Boolean);
        const [profiles, classResources] = await Promise.all([
          cls.school_id
            ? base44.entities.UserProfile.filter({ school_id: cls.school_id })
            : base44.entities.UserProfile.list(),
          base44.entities.Resource.filter({ class_id: classId }),
        ]);
        setTeachers(
          teacherEmails
            .map((email) => profiles.find((p) => p.user_email === email))
            .filter(Boolean)
        );
        setStudents(
          (cls.student_emails || [])
            .map((email) => profiles.find((p) => p.user_email === email))
            .filter(Boolean)
        );
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
      const updatedStudents = classData.student_emails.filter((e) => e !== email);
      await base44.entities.Class.update(classId, { student_emails: updatedStudents });
      loadData();
      toast.success('Student removed');
    } catch (error) {
      toast.error('Failed to remove student');
    }
  };

  const isTeacher = profile?.user_type === 'teacher' || profile?.user_type === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-primary animate-spin" />
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="text-center py-16">
        <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Class not found</h2>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <Link to={createPageUrl('Classes')} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Classes
          </Link>
          <h1 className="text-3xl font-bold text-foreground">{classData.name}</h1>
          <p className="text-muted-foreground mt-1">
            {classData.subject}
            {classData.room && <span className="mx-2">·</span>}
            {classData.room && <span>Room {classData.room}</span>}
          </p>
        </div>
        {isTeacher && (
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" onClick={copyJoinCode}>
              {copiedCode ? <Check className="h-4 w-4 mr-2 text-success" /> : <Copy className="h-4 w-4 mr-2" />}
              {classData.join_code}
            </Button>
            <Button className="bg-gradient-to-br from-brand-violet via-primary to-brand-pink text-primary-foreground" asChild>
              <Link to={createPageUrl(`IssuePoints?class=${classId}`)}>
                <Award className="h-4 w-4 mr-2" />
                Issue Points
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Class stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="surface-card">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Students</p>
              <p className="text-2xl font-bold text-foreground">{students.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="surface-card">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Resources</p>
              <p className="text-2xl font-bold text-foreground">{resources.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="surface-card">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <DoorOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Room</p>
              <p className="text-2xl font-bold text-foreground">{classData.room || 'TBA'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workspace tabs */}
      <Tabs defaultValue="stream" className="space-y-6">
        <TabsList className="bg-secondary/60">
          <TabsTrigger value="stream">
            <MessageSquare className="h-4 w-4 mr-2" />
            Stream
          </TabsTrigger>
          <TabsTrigger value="classwork">
            <ClipboardList className="h-4 w-4 mr-2" />
            Classwork
          </TabsTrigger>
          <TabsTrigger value="people">
            <Users className="h-4 w-4 mr-2" />
            People
          </TabsTrigger>
          <TabsTrigger value="grades">
            <GraduationCap className="h-4 w-4 mr-2" />
            Grades
          </TabsTrigger>
          {isTeacher && (
            <TabsTrigger value="seating">
              <BookOpen className="h-4 w-4 mr-2" />
              Seating
            </TabsTrigger>
          )}
          <TabsTrigger value="resources">
            <FileText className="h-4 w-4 mr-2" />
            Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stream">
          <StreamTab classId={classId} classData={classData} profile={profile} isTeacher={isTeacher} />
        </TabsContent>

        <TabsContent value="classwork">
          <ClassworkTab classId={classId} canManage={isTeacher} />
        </TabsContent>

        <TabsContent value="people">
          <div className="space-y-6">
            {/* Teachers */}
            <Card className="surface-card">
              <CardHeader><CardTitle className="text-base">Teaching staff</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {teachers.length > 0 ? teachers.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/60 border border-border">
                      <Shield className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{t.first_name} {t.last_name}</p>
                        <p className="text-xs text-tertiary">{t.department || 'Teacher'}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">No staff assigned</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Students */}
            <Card className="surface-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Students ({students.length})</CardTitle>
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
                        {isTeacher && <TableHead className="w-32">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">
                            {student.first_name} {student.last_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{student.user_email}</TableCell>
                          <TableCell>{student.student_id || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-success/15 text-success">+{student.total_achievement_points || 0}</Badge>
                              <Badge variant="outline" className="text-destructive">-{student.total_behaviour_points || 0}</Badge>
                            </div>
                          </TableCell>
                          {isTeacher && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                  className="text-primary hover:text-primary"
                                  title="Grades, work, attendance, points and achievements"
                                >
                                  <Link to={createPageUrl(`StudentProgress?student=${encodeURIComponent(student.user_email)}`)}>
                                    <TrendingUp className="h-4 w-4 mr-1" />
                                    Progress
                                  </Link>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.location.href = createPageUrl(`IssueBlockWard?studentId=${student.id}`)}
                                  className="text-primary hover:text-primary"
                                  title="Mint BlockWard NFT"
                                >
                                  <Sparkles className="h-4 w-4 mr-1" />
                                  Mint
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveStudent(student.user_email)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No students enrolled yet</p>
                    {isTeacher && (
                      <p className="text-sm mt-2">Share the join code: <span className="font-mono font-bold">{classData.join_code}</span></p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="grades">
          <GradesTab classId={classId} classData={classData} isTeacher={isTeacher} />
        </TabsContent>

        <TabsContent value="seating">
          {isTeacher ? (
            <SeatingPlanTab classId={classId} canEdit={isTeacher} />
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Seating plans are managed by your teacher.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="resources">
          <Card className="surface-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Class Resources</CardTitle>
              {isTeacher && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={createPageUrl(`Resources?class=${classId}`)}>
                    <FileText className="h-4 w-4 mr-2" />
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
                      className="flex items-center gap-4 p-4 rounded-xl bg-secondary/60 border border-border hover:bg-hover transition-colors"
                    >
                      <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{resource.title}</p>
                        <p className="text-sm text-muted-foreground">{resource.description || resource.file_type}</p>
                      </div>
                      <Badge variant="outline">{resource.file_type}</Badge>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No resources uploaded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Join code QR — teachers only */}
      {isTeacher && classData.join_code && (
        <Card className="surface-card">
          <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-5">
            <div className="flex-shrink-0">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=${encodeURIComponent(`${window.location.origin}/JoinClass?code=${classData.join_code}`)}`}
                alt="Class join QR code"
                className="h-40 w-40 rounded-lg bg-white p-1"
              />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-semibold text-foreground">Class join code</h3>
              <p className="text-sm text-muted-foreground mt-1">Students scan the QR or enter the code to join this class. Scanning opens a join confirmation (or sign-up first if logged out).</p>
              <div className="flex items-center gap-2 mt-3 justify-center sm:justify-start">
                <code className="px-3 py-2 rounded-lg bg-secondary/60 border border-border text-base font-mono font-semibold text-foreground tracking-wider">{classData.join_code}</code>
                <Button variant="outline" size="icon" onClick={copyJoinCode}>
                  {copiedCode ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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