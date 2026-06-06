import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['academic', 'sports', 'arts', 'leadership', 'community', 'behaviour', 'special'];

export default function CreateRecordDialog({ open, onOpenChange, teacherProfile, onCreated }) {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({ student_id: '', class_id: '', title: '', category: 'academic', description: '' });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !teacherProfile) return;
    loadData();
  }, [open, teacherProfile]);

  const loadData = async () => {
    const myClasses = await base44.entities.Class.filter({ teacher_email: teacherProfile.user_email, school_id: teacherProfile.school_id });
    setClasses(myClasses);
    // Load students from the teacher's classes
    const allEmails = new Set();
    myClasses.forEach(c => c.student_emails?.forEach(e => allEmails.add(e)));
    if (allEmails.size > 0) {
      const allStudents = await base44.entities.UserProfile.filter({ user_type: 'student', school_id: teacherProfile.school_id });
      setStudents(allStudents.filter(s => allEmails.has(s.user_email)));
    }
  };

  const handleSubmit = async () => {
    if (!form.student_id || !form.title || !form.category) {
      toast.error('Please fill in student, title, and category');
      return;
    }
    setSaving(true);
    try {
      const student = students.find(s => s.id === form.student_id);
      const cls = classes.find(c => c.id === form.class_id);

      let fileUrl = null;
      if (file) {
        setUploading(true);
        const result = await base44.integrations.Core.UploadFile({ file });
        fileUrl = result.file_url;
        setUploading(false);
      }

      const record = await base44.entities.StudentRecord.create({
        school_id: teacherProfile.school_id,
        class_id: form.class_id || null,
        class_name: cls?.name || null,
        teacher_id: teacherProfile.id,
        teacher_email: teacherProfile.user_email,
        teacher_name: `${teacherProfile.first_name} ${teacherProfile.last_name}`,
        student_id: student?.id,
        student_email: student?.user_email,
        student_name: `${student?.first_name} ${student?.last_name}`,
        title: form.title,
        category: form.category,
        description: form.description,
        file_url: fileUrl,
        status: 'draft',
        submitted_at: new Date().toISOString()
      });

      await base44.entities.AuditLog.create({
        record_id: record.id,
        school_id: teacherProfile.school_id,
        actor_email: teacherProfile.user_email,
        actor_name: `${teacherProfile.first_name} ${teacherProfile.last_name}`,
        actor_role: 'teacher',
        action: 'created',
        new_status: 'draft',
        timestamp: new Date().toISOString()
      });

      toast.success('Record created!');
      onCreated?.();
      onOpenChange(false);
      setForm({ student_id: '', class_id: '', title: '', category: 'academic', description: '' });
      setFile(null);
    } catch (err) {
      toast.error('Failed to create record: ' + err.message);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Student Record</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Student *</Label>
            <Select value={form.student_id} onValueChange={v => setForm({ ...form, student_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select student..." /></SelectTrigger>
              <SelectContent>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.user_email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Class (optional)</Label>
            <Select value={form.class_id} onValueChange={v => setForm({ ...form, class_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select class..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Top in Mathematics Term 1" />
          </div>

          <div className="space-y-2">
            <Label>Category *</Label>
            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Details about this award or record..." />
          </div>

          <div className="space-y-2">
            <Label>Supporting File (optional)</Label>
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:border-violet-300 transition-colors"
              onClick={() => document.getElementById('record-file-input').click()}>
              <Upload className="h-6 w-6 mx-auto text-slate-400 mb-1" />
              <p className="text-sm text-slate-500">{file ? file.name : 'Click to upload image or document'}</p>
              <input id="record-file-input" type="file" accept="image/*,.pdf,.doc,.docx" className="hidden"
                onChange={e => setFile(e.target.files[0])} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || uploading}>
            {(saving || uploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}