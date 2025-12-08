import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, Users, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ParentComms() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [sending, setSending] = useState(false);
  const [emailData, setEmailData] = useState({
    subject: '',
    message: ''
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
        
        // Load students based on role
        if (profiles[0].user_type === 'teacher') {
          const classes = await base44.entities.Class.filter({ teacher_email: user.email });
          const studentEmails = new Set();
          classes.forEach(cls => {
            cls.student_emails?.forEach(email => studentEmails.add(email));
          });
          
          const studentProfiles = await base44.entities.UserProfile.filter({ user_type: 'student' });
          setStudents(studentProfiles.filter(s => studentEmails.has(s.user_email)));
        } else if (profiles[0].user_type === 'admin') {
          const studentProfiles = await base44.entities.UserProfile.filter({ user_type: 'student' });
          setStudents(studentProfiles);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEmailDialog = (student) => {
    setSelectedStudent(student);
    setEmailData({
      subject: `Update about ${student.first_name} ${student.last_name}`,
      message: ''
    });
    setShowDialog(true);
  };

  const sendEmail = async () => {
    if (!emailData.subject || !emailData.message) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!selectedStudent.parent_email) {
      toast.error('No parent email on file');
      return;
    }

    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: selectedStudent.parent_email,
        subject: emailData.subject,
        body: emailData.message
      });
      
      toast.success('Email sent to parent');
      setShowDialog(false);
      setEmailData({ subject: '', message: '' });
    } catch (error) {
      toast.error('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const sendToStudent = async (student) => {
    if (!emailData.subject || !emailData.message) {
      toast.error('Please fill in all fields');
      return;
    }

    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: student.user_email,
        subject: emailData.subject,
        body: emailData.message
      });
      
      toast.success('Email sent to student');
    } catch (error) {
      toast.error('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const filteredStudents = students.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.student_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Parent Communications</h1>
          <p className="text-slate-500 mt-1">Send emails to parents and students</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 rounded-lg">
          <Users className="h-5 w-5 text-violet-600" />
          <span className="font-semibold text-violet-900">{students.length} Students</span>
        </div>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredStudents.map((student) => (
              <div key={student.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                    {student.first_name[0]}{student.last_name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {student.first_name} {student.last_name}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-sm text-slate-500">ID: {student.student_id}</p>
                      {student.parent_email && (
                        <Badge variant="outline" className="text-xs">
                          <Mail className="h-3 w-3 mr-1" />
                          Parent: {student.parent_name || student.parent_email}
                        </Badge>
                      )}
                      {!student.parent_email && (
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                          No parent email
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedStudent(student);
                      setEmailData({
                        subject: `Message for ${student.first_name}`,
                        message: ''
                      });
                      setShowDialog(true);
                    }}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Email Student
                  </Button>
                  {student.parent_email && (
                    <Button
                      size="sm"
                      onClick={() => openEmailDialog(student)}
                      className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Email Parent
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredStudents.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No students found</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Send Email to {selectedStudent && (
                <span className="text-violet-600">
                  {emailData.subject.includes('Email Student') 
                    ? `${selectedStudent.first_name} ${selectedStudent.last_name}` 
                    : `${selectedStudent.parent_name || 'Parent'} (${selectedStudent.first_name}'s Parent)`}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={emailData.subject}
                onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                placeholder="Email subject"
              />
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={emailData.message}
                onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
                placeholder="Write your message..."
                rows={8}
                className="resize-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (emailData.subject.includes('Email Student')) {
                    sendToStudent(selectedStudent);
                  } else {
                    sendEmail();
                  }
                }}
                disabled={sending}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}