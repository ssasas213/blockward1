import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, ArrowRight, Loader2, CheckCircle2, Award,
  BookOpen, User, AlertTriangle, Upload, ImageIcon, FileText,
  Clock, ClipboardCheck, Sparkles, Shield, PenLine
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const CATEGORIES = ['academic', 'sports', 'arts', 'leadership', 'community', 'special'];
const CATEGORY_LABELS = {
  academic: 'Academic', sports: 'Sports', arts: 'Arts',
  leadership: 'Leadership', community: 'Community', special: 'Special'
};

// Step progress indicator
function StepProgress({ currentStep }) {
  const steps = [
    { num: 1, label: 'Create Record', icon: FileText },
    { num: 2, label: 'Teacher Signature', icon: PenLine },
    { num: 3, label: 'Admin Approval', icon: Shield },
  ];
  return (
    <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-5">
      <p className="text-xs font-bold text-violet-700 uppercase tracking-wider mb-4 text-center">Secure Issuance Workflow</p>
      <div className="flex items-center justify-between max-w-lg mx-auto">
        {steps.map((step, i) => (
          <React.Fragment key={step.num}>
            <div className="flex flex-col items-center gap-2 flex-1">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all ${
                currentStep === step.num
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                  : currentStep > step.num
                  ? 'bg-green-500 text-white'
                  : 'bg-white border-2 border-slate-200 text-slate-400'
              }`}>
                {currentStep > step.num
                  ? <CheckCircle2 className="h-6 w-6" />
                  : <step.icon className="h-5 w-5" />
                }
              </div>
              <div className="text-center">
                <p className={`text-xs font-semibold ${currentStep >= step.num ? 'text-slate-800' : 'text-slate-400'}`}>
                  Step {step.num}
                </p>
                <p className={`text-xs ${currentStep >= step.num ? 'text-slate-600' : 'text-slate-400'}`}>
                  {step.label}
                </p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 mb-6 transition-all ${currentStep > step.num ? 'bg-green-400' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function IssueBlockWardContent() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [schoolId, setSchoolId] = useState(null);
  const [myClasses, setMyClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [uploadingSupporting, setUploadingSupporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submittedRecord, setSubmittedRecord] = useState(null);

  const [formData, setFormData] = useState({
    selectedStudent: null,
    selectedClass: null,
    title: '',
    description: '',
    category: '',
    dateAchieved: new Date().toISOString().split('T')[0],
    teacherComments: '',
    evidenceUrl: '',
    evidenceType: '',
    supportingDocUrl: '',
    confirmed: false,
  });

  const evidenceInputRef = useRef(null);
  const supportingInputRef = useRef(null);

  useEffect(() => { loadContext(); }, []);

  const loadContext = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (!currentUser) return;
      setUser(currentUser);
      const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      const p = profiles[0] || null;
      setProfile(p);
      const sid = p?.school_id || null;
      setSchoolId(sid);

      // Teachers only — admins are blocked by the access denied screen above
      let classes = [];
      const memberships = await base44.entities.StaffMembership.filter({ user_email: currentUser.email });
      const membership = memberships[0];
      if (membership?.class_ids?.length > 0) {
        const all = await base44.entities.Class.list();
        classes = all.filter(c => membership.class_ids.includes(c.id));
      } else {
        classes = await base44.entities.Class.filter({ teacher_email: currentUser.email });
      }
      setMyClasses(classes);
    } catch (e) {
      toast.error('Failed to load class data');
    } finally {
      setLoading(false);
    }
  };

  const handleClassSelect = async (classId) => {
    setSelectedClassId(classId);
    const cls = myClasses.find(c => c.id === classId) || null;
    setFormData(prev => ({ ...prev, selectedStudent: null, selectedClass: cls }));
    setEnrolledStudents([]);
    setLoadingStudents(true);
    try {
      const enrollments = await base44.entities.Enrollment.filter({ class_id: classId, status: 'active' });
      let students = [];
      if (enrollments.length > 0) {
        const emails = enrollments.map(e => e.student_email);
        const allProfiles = await base44.entities.UserProfile.list();
        students = allProfiles
          .filter(p => emails.includes(p.user_email) && p.user_type === 'student')
          .map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, email: p.user_email, gradeLevel: p.grade_level || '' }));
      } else if (cls?.student_emails?.length > 0) {
        const allProfiles = await base44.entities.UserProfile.list();
        students = allProfiles
          .filter(p => cls.student_emails.includes(p.user_email) && p.user_type === 'student')
          .map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, email: p.user_email, gradeLevel: p.grade_level || '' }));
      }
      setEnrolledStudents(students);
    } catch (e) {
      toast.error('Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const setter = field === 'evidence' ? setUploadingEvidence : setUploadingSupporting;
    setter(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const ext = file.name.split('.').pop().toLowerCase();
      const type = ['pdf'].includes(ext) ? 'pdf' : ['mp4', 'mov', 'webm'].includes(ext) ? 'video' : 'image';
      if (field === 'evidence') {
        setFormData(p => ({ ...p, evidenceUrl: file_url, evidenceType: type }));
      } else {
        setFormData(p => ({ ...p, supportingDocUrl: file_url }));
      }
      toast.success('File uploaded successfully!');
    } catch (err) {
      toast.error('Upload failed. Please try again.');
    } finally {
      setter(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.selectedClass) { toast.error('Please select a class'); return; }
      if (!formData.selectedStudent) { toast.error('Please select a student'); return; }
    }
    if (currentStep === 2) {
      if (!formData.title.trim()) { toast.error('Please enter a title'); return; }
      if (!formData.category) { toast.error('Please select a category'); return; }
      if (!formData.description.trim()) { toast.error('Description is required'); return; }
      if (!formData.dateAchieved) { toast.error('Please enter the date achieved'); return; }
      if (!formData.evidenceUrl) { toast.error('Evidence upload is required'); return; }
    }
    setCurrentStep(s => Math.min(s + 1, 3));
  };

  const handleSubmitForApproval = async () => {
    if (!formData.confirmed) { toast.error('Please tick the confirmation checkbox'); return; }
    setSubmitting(true);
    try {
      const teacherName = `${profile.first_name} ${profile.last_name}`;
      const record = await base44.entities.StudentRecord.create({
        school_id: schoolId,
        class_id: formData.selectedClass?.id,
        class_name: formData.selectedClass?.name,
        teacher_id: profile.id,
        teacher_email: user.email,
        teacher_name: teacherName,
        student_id: formData.selectedStudent?.id,
        student_email: formData.selectedStudent?.email,
        student_name: formData.selectedStudent?.name,
        title: formData.title,
        category: formData.category,
        description: formData.description,
        date_achieved: formData.dateAchieved,
        file_url: formData.evidenceUrl,
        file_type: formData.evidenceType,
        status: 'draft',
      });

      await base44.functions.invoke('recordWorkflow', {
        action: 'teacherSubmitRecord',
        recordId: record.id,
      });

      setSubmittedRecord(record);
      setSubmitSuccess(true);
      toast.success('Achievement record created! Now apply your digital signature.');
    } catch (error) {
      toast.error(error.message || 'Failed to submit achievement.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
    </div>
  );

  // SECURITY: Only teachers can create achievement records. Admins review/approve only.
  if (profile && profile.user_type !== 'teacher') {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500 mb-3">Only teachers can create and submit achievement records.</p>
        <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg p-3">
          Admins can review and approve records via the <strong>Approval Queue</strong>.
          Achievement records must be created by a teacher and go through the full approval workflow.
        </p>
      </div>
    );
  }

  if (submitting) return (
    <div className="max-w-2xl mx-auto py-12">
      <Card className="border-0 shadow-2xl">
        <CardContent className="p-12 text-center space-y-4">
          <Loader2 className="h-16 w-16 animate-spin text-violet-500 mx-auto" />
          <h2 className="text-2xl font-bold text-slate-900">Creating Achievement Record...</h2>
          <p className="text-slate-500">Routing through the digital custodian approval workflow.</p>
        </CardContent>
      </Card>
    </div>
  );

  if (submitSuccess) return (
    <div className="max-w-2xl mx-auto py-12">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="border-0 shadow-2xl">
          <CardContent className="p-12 text-center">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Record Created!</h2>
            <p className="text-slate-500 mb-6">
              Achievement record for <strong className="text-slate-800">{formData.selectedStudent?.name}</strong> is now awaiting your digital signature.
            </p>
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-8 text-left space-y-3">
              <p className="text-sm font-bold text-violet-800">3-Step Approval Required:</p>
              <div className="space-y-2">
                {[
                  { num: '1', label: 'Your Digital Signature', desc: 'Apply your teacher signature to verify this achievement', done: false, active: true },
                  { num: '2', label: 'Admin Review & Approval', desc: 'Admin reviews evidence and applies their signature', done: false, active: false },
                  { num: '3', label: 'Certificate & Archive', desc: 'Certificate generated and saved to student portfolio', done: false, active: false },
                ].map(s => (
                  <div key={s.num} className={`flex items-start gap-3 p-3 rounded-lg ${s.active ? 'bg-violet-100' : 'bg-white border border-violet-100'}`}>
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${s.active ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {s.num}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${s.active ? 'text-violet-900' : 'text-slate-600'}`}>{s.label}</p>
                      <p className="text-xs text-slate-500">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {submittedRecord && (
                <Button
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg"
                  onClick={() => navigate(createPageUrl(`RecordDetail?id=${submittedRecord.id}`))}
                >
                  <PenLine className="h-4 w-4 mr-2" /> Apply My Signature Now
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate(createPageUrl('TeacherRecords'))}>
                <FileText className="h-4 w-4 mr-2" /> View All Records
              </Button>
              <Button variant="ghost" onClick={() => window.location.reload()}>
                <Award className="h-4 w-4 mr-2" /> Create Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );

  const backPage = 'TeacherRecords';

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      <input ref={evidenceInputRef} type="file" accept="image/*,.pdf,.mp4,.mov,.webm" className="hidden"
        onChange={e => handleFileUpload(e, 'evidence')} />
      <input ref={supportingInputRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden"
        onChange={e => handleFileUpload(e, 'supporting')} />

      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl(backPage))}
          className="hover:bg-slate-100 rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Create Achievement Record</h1>
          <p className="text-slate-500 mt-0.5">Secure 3-step digital custodian approval workflow</p>
        </div>
      </div>

      {/* Security Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Secure Issuance — No direct NFT minting allowed</p>
          <p className="text-xs text-amber-700 mt-0.5">All records require: evidence upload → teacher digital signature → admin approval → then the certificate and NFT are generated automatically.</p>
        </div>
      </div>

      <StepProgress currentStep={currentStep} />

      <Card className="border-0 shadow-xl shadow-slate-200/60">
        <CardContent className="p-8">

          {/* Step 1: Select Class & Student */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-1">Step 1 — Select Student</h2>
                <p className="text-sm text-slate-500">Choose the class and student this achievement record is for.</p>
              </div>

              {myClasses.length === 0 ? (
                <div className="text-center py-16">
                  <BookOpen className="h-14 w-14 mx-auto mb-4 text-slate-300" />
                  <p className="font-semibold text-slate-600">No classes assigned yet</p>
                  <p className="text-sm text-slate-400 mt-1">Ask an admin to assign you to a class first.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="font-semibold">Class *</Label>
                    <Select value={selectedClassId} onValueChange={handleClassSelect}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {myClasses.map(cls => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}{cls.subject ? ` — ${cls.subject}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedClassId && (
                    <div className="space-y-3">
                      <Label className="font-semibold">Student *</Label>
                      {loadingStudents ? (
                        <div className="flex items-center gap-3 text-slate-500 text-sm py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-violet-500" /> Loading students...
                        </div>
                      ) : enrolledStudents.length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
                          <User className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                          <p className="font-medium text-slate-500">No students enrolled in this class</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {enrolledStudents.map(student => {
                            const isSelected = formData.selectedStudent?.id === student.id;
                            return (
                              <button
                                key={student.id}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, selectedStudent: student }))}
                                className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                                  isSelected
                                    ? 'border-violet-500 bg-violet-50 shadow-md shadow-violet-100'
                                    : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'
                                }`}
                              >
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                                  isSelected ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {student.name[0]?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-slate-900 truncate">{student.name}</p>
                                  {student.gradeLevel && <p className="text-xs text-slate-500">{student.gradeLevel}</p>}
                                </div>
                                {isSelected && <CheckCircle2 className="h-5 w-5 text-violet-500 flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 2: Achievement Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-1">Step 2 — Achievement Details</h2>
                <p className="text-sm text-slate-500">
                  For <strong className="text-slate-700">{formData.selectedStudent?.name}</strong>
                  {formData.selectedClass?.name && <> · <strong className="text-slate-700">{formData.selectedClass.name}</strong></>}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Achievement Title *</Label>
                <Input
                  value={formData.title}
                  onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Top in Mathematics - Term 1"
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold">Category *</Label>
                  <Select value={formData.category} onValueChange={v => setFormData(p => ({ ...p, category: v }))}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold">Date Achieved *</Label>
                  <Input
                    type="date"
                    value={formData.dateAchieved}
                    onChange={e => setFormData(p => ({ ...p, dateAchieved: e.target.value }))}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Description * <span className="font-normal text-slate-400 text-xs">(required for approval)</span></Label>
                <Textarea
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe what the student did to earn this achievement in detail..."
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Teacher Comments <span className="font-normal text-slate-400 text-xs">(for admin review)</span></Label>
                <Textarea
                  value={formData.teacherComments}
                  onChange={e => setFormData(p => ({ ...p, teacherComments: e.target.value }))}
                  placeholder="Additional context for the reviewing admin..."
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Evidence Upload — REQUIRED */}
              <div className="space-y-3 border-2 border-violet-200 bg-violet-50 rounded-xl p-5">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <Label className="font-bold text-slate-900 text-sm">Evidence Upload * <span className="font-normal text-red-500">(required)</span></Label>
                    <p className="text-xs text-slate-500">Photo, PDF, or video proving the achievement</p>
                  </div>
                </div>

                {formData.evidenceUrl ? (
                  <div className="flex items-center gap-4 p-4 bg-white border-2 border-green-200 rounded-xl">
                    {formData.evidenceType === 'image' ? (
                      <img src={formData.evidenceUrl} alt="Evidence" className="h-16 w-16 object-cover rounded-lg border border-green-200 flex-shrink-0" />
                    ) : (
                      <div className="h-16 w-16 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="h-8 w-8 text-green-500" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <p className="text-sm font-semibold text-slate-800">Evidence uploaded</p>
                      </div>
                      <div className="flex gap-3">
                        <button type="button" onClick={() => evidenceInputRef.current?.click()}
                          className="text-xs text-violet-600 hover:text-violet-800 font-medium underline">Change</button>
                        <button type="button" onClick={() => setFormData(p => ({ ...p, evidenceUrl: '', evidenceType: '' }))}
                          className="text-xs text-red-500 hover:text-red-700 font-medium underline">Remove</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button type="button" onClick={() => evidenceInputRef.current?.click()} disabled={uploadingEvidence}
                    className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white gap-2">
                    {uploadingEvidence ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</> : <><Upload className="h-4 w-4" /> Upload Evidence File</>}
                  </Button>
                )}
              </div>

              {/* Supporting Documents — Optional */}
              <div className="space-y-3 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-slate-500" />
                  </div>
                  <div>
                    <Label className="font-semibold text-slate-800 text-sm">Supporting Documents <span className="font-normal text-slate-400">(optional)</span></Label>
                    <p className="text-xs text-slate-400">Letters, certificates, or additional files</p>
                  </div>
                </div>
                {formData.supportingDocUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-slate-700 flex-1">Supporting document uploaded</p>
                    <button type="button" onClick={() => setFormData(p => ({ ...p, supportingDocUrl: '' }))}
                      className="text-xs text-red-500 underline">Remove</button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" onClick={() => supportingInputRef.current?.click()} disabled={uploadingSupporting}
                    className="w-full h-10 gap-2 text-slate-600">
                    {uploadingSupporting ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</> : <><Upload className="h-4 w-4" /> Upload Supporting Document</>}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Review & Submit */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-1">Step 3 — Review & Submit for Signature</h2>
                <p className="text-sm text-slate-500">Carefully review all details before submitting. Once submitted, you must apply your digital signature.</p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-slate-500" />
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Submission Summary</p>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                    <div className="h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center font-bold text-violet-700 text-lg flex-shrink-0">
                      {formData.selectedStudent?.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-lg">{formData.selectedStudent?.name}</p>
                      <p className="text-sm text-slate-500">{formData.selectedClass?.name}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Achievement Title</p>
                    <p className="font-bold text-slate-900 text-lg">{formData.title}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge className="bg-violet-100 text-violet-700 border-violet-200">{CATEGORY_LABELS[formData.category]}</Badge>
                    <Badge variant="outline" className="text-slate-600">{formData.dateAchieved}</Badge>
                    {formData.evidenceUrl && <Badge className="bg-green-100 text-green-700 border-green-200">✓ Evidence attached</Badge>}
                    {formData.supportingDocUrl && <Badge className="bg-blue-100 text-blue-700 border-blue-200">✓ Supporting docs</Badge>}
                  </div>
                  {formData.description && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Description</p>
                      <p className="text-sm text-slate-700">{formData.description}</p>
                    </div>
                  )}
                  {formData.teacherComments && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                      <p className="text-xs font-semibold text-blue-600 mb-1">Teacher Comments (for admin)</p>
                      <p className="text-sm text-blue-800">{formData.teacherComments}</p>
                    </div>
                  )}
                  {formData.evidenceUrl && formData.evidenceType === 'image' && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2">Evidence Preview</p>
                      <img src={formData.evidenceUrl} alt="Evidence" className="h-32 w-full object-cover rounded-lg border border-slate-200" />
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-violet-800">📋 What happens after you submit:</p>
                <ol className="text-sm text-violet-700 space-y-1 list-decimal list-inside">
                  <li>You will be taken to apply your <strong>digital teacher signature</strong></li>
                  <li>Admin receives notification and reviews your submission with evidence</li>
                  <li>Admin applies their <strong>digital signature</strong> to approve</li>
                  <li>Certificate PDF and NFT are automatically generated and archived</li>
                </ol>
              </div>

              <div className="flex items-start gap-3 p-4 bg-slate-50 border-2 border-slate-200 rounded-xl">
                <Checkbox
                  id="confirm"
                  checked={formData.confirmed}
                  onCheckedChange={v => setFormData(p => ({ ...p, confirmed: v }))}
                  className="mt-0.5"
                />
                <label htmlFor="confirm" className="text-sm text-slate-700 cursor-pointer leading-relaxed">
                  I, <strong>{profile?.first_name} {profile?.last_name}</strong>, confirm this achievement record for <strong>{formData.selectedStudent?.name}</strong> is accurate and genuine. I understand this will go through a mandatory multi-step approval process before being permanently recorded. I am responsible for the authenticity of this submission.
                </label>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-6 mt-6 border-t border-slate-100">
            <Button variant="outline" onClick={() => setCurrentStep(s => Math.max(s - 1, 1))}
              disabled={currentStep === 1} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {currentStep < 3 ? (
              <Button onClick={handleNext} className="gap-2 bg-violet-600 hover:bg-violet-700">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmitForApproval}
                disabled={!formData.confirmed}
                className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg disabled:opacity-40"
              >
                <PenLine className="h-4 w-4" /> Submit For Signature
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function IssueBlockWard() {
  return (
    <ProtectedRoute>
      <IssueBlockWardContent />
    </ProtectedRoute>
  );
}