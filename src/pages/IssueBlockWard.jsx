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
  Clock, ClipboardCheck, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const CATEGORIES = ['Academic', 'Sports', 'Arts', 'Leadership', 'Community', 'Innovation'];

const RARITY_GRADIENTS = {
  Common: 'from-slate-400 to-slate-600',
  Rare: 'from-blue-500 to-indigo-600',
  Epic: 'from-purple-500 to-violet-700',
  Legendary: 'from-amber-400 to-orange-600',
};

function WorkflowSteps() {
  const steps = [
    { icon: Upload, label: 'Submit Evidence', desc: 'Upload & describe achievement' },
    { icon: ClipboardCheck, label: 'Teacher Review', desc: 'Teacher signs off' },
    { icon: CheckCircle2, label: 'Admin Approval', desc: 'Admin authorises' },
    { icon: Sparkles, label: 'NFT Minted', desc: 'Permanently on-chain' },
  ];
  return (
    <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-5">
      <p className="text-xs font-bold text-violet-700 uppercase tracking-wider mb-4">Approval Workflow</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {steps.map((s, i) => (
          <div key={i} className="flex flex-col items-center text-center gap-2">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${i === 0 ? 'bg-violet-600 text-white' : 'bg-white border-2 border-violet-200 text-violet-400'}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">{s.label}</p>
              <p className="text-xs text-slate-500">{s.desc}</p>
            </div>
          </div>
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
  const [uploadingFile, setUploadingFile] = useState(false);
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
    confirmed: false,
  });

  const fileInputRef = useRef(null);

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

      let classes = [];
      if (p?.user_type === 'admin') {
        classes = sid ? await base44.entities.Class.filter({ school_id: sid }) : await base44.entities.Class.list();
      } else {
        const memberships = await base44.entities.StaffMembership.filter({ user_email: currentUser.email });
        const membership = memberships[0];
        if (membership?.class_ids?.length > 0) {
          const all = await base44.entities.Class.list();
          classes = all.filter(c => membership.class_ids.includes(c.id));
        } else {
          classes = await base44.entities.Class.filter({ teacher_email: currentUser.email });
        }
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

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const ext = file.name.split('.').pop().toLowerCase();
      const type = ['pdf'].includes(ext) ? 'pdf' : ['mp4', 'mov', 'webm'].includes(ext) ? 'video' : 'image';
      setFormData(p => ({ ...p, evidenceUrl: file_url, evidenceType: type }));
      toast.success('Evidence uploaded!');
    } catch (err) {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploadingFile(false);
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
      if (!formData.dateAchieved) { toast.error('Please enter the date achieved'); return; }
    }
    setCurrentStep(s => Math.min(s + 1, 3));
  };

  const handleSubmitForApproval = async () => {
    if (!formData.confirmed) { toast.error('Please tick the confirmation checkbox'); return; }
    setSubmitting(true);
    try {
      // 1. Create the StudentRecord as draft
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
        category: formData.category.toLowerCase(),
        description: formData.description,
        date_achieved: formData.dateAchieved,
        file_url: formData.evidenceUrl,
        file_type: formData.evidenceType,
        status: 'draft',
      });

      // 2. Use workflow to move draft → awaiting_teacher_signature
      await base44.functions.invoke('recordWorkflow', {
        action: 'teacherSubmitRecord',
        recordId: record.id,
      });

      setSubmittedRecord(record);
      setSubmitSuccess(true);
      toast.success('Achievement submitted for approval!');
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

  if (profile && (profile.user_type !== 'teacher' && profile.user_type !== 'admin')) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500">Only teachers and admins can submit achievement records.</p>
      </div>
    );
  }

  if (submitting) return (
    <div className="max-w-2xl mx-auto py-12">
      <Card className="border-0 shadow-2xl">
        <CardContent className="p-12 text-center space-y-4">
          <Loader2 className="h-16 w-16 animate-spin text-violet-500 mx-auto" />
          <h2 className="text-2xl font-bold text-slate-900">Submitting for Approval...</h2>
          <p className="text-slate-500">Creating the achievement record and routing it for review.</p>
        </CardContent>
      </Card>
    </div>
  );

  if (submitSuccess) return (
    <div className="max-w-2xl mx-auto py-12">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="border-0 shadow-2xl">
          <CardContent className="p-12 text-center">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/30">
              <Clock className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Submitted for Approval!</h2>
            <p className="text-slate-500 mb-6">
              The achievement for <strong className="text-slate-800">{formData.selectedStudent?.name}</strong> has been submitted.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-left space-y-2">
              <p className="text-sm font-semibold text-amber-800">What happens next:</p>
              <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
                <li>You must review and digitally sign this record</li>
                <li>An admin will then review and sign</li>
                <li>Once both signatures are applied, the NFT can be minted</li>
              </ol>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate(createPageUrl('TeacherRecords'))}>
                <FileText className="h-4 w-4 mr-2" /> View My Records
              </Button>
              {submittedRecord && (
                <Button
                  className="bg-gradient-to-r from-violet-600 to-indigo-600"
                  onClick={() => navigate(createPageUrl(`RecordDetail?id=${submittedRecord.id}`))}
                >
                  Sign This Record Now →
                </Button>
              )}
              <Button variant="ghost" onClick={() => window.location.reload()}>
                <Award className="h-4 w-4 mr-2" /> Submit Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.mp4,.mov,.webm"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('TeacherRecords'))}
          className="hover:bg-slate-100 rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Submit Achievement for Approval</h1>
          <p className="text-slate-500 mt-0.5">Start the digital custodian approval workflow</p>
        </div>
      </div>

      <WorkflowSteps />

      {/* Step Indicators */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(step => (
          <React.Fragment key={step}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              currentStep === step ? 'bg-violet-600 text-white' :
              currentStep > step ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
            }`}>
              {currentStep > step ? <CheckCircle2 className="h-4 w-4" /> : <span>{step}</span>}
              <span className="hidden sm:inline">{['Select Student', 'Achievement Details', 'Review & Submit'][step - 1]}</span>
            </div>
            {step < 3 && <div className="h-px flex-1 bg-slate-200" />}
          </React.Fragment>
        ))}
      </div>

      <Card className="border-0 shadow-xl shadow-slate-200/60">
        <CardContent className="p-8">

          {/* Step 1: Select Class & Student */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-1">Select Class &amp; Student</h2>
                <p className="text-sm text-slate-500">Choose which student to submit an achievement for.</p>
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
                                className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150 ${
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
                <h2 className="text-xl font-semibold text-slate-900 mb-1">Achievement Details</h2>
                <p className="text-sm text-slate-500">
                  Submitting for <strong className="text-slate-700">{formData.selectedStudent?.name}</strong>
                  {formData.selectedClass?.name && <> in <strong className="text-slate-700">{formData.selectedClass.name}</strong></>}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Achievement Title *</Label>
                <Input
                  value={formData.title}
                  onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Perfect Attendance, Top Scorer, Most Creative"
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold">Category *</Label>
                  <Select value={formData.category} onValueChange={v => setFormData(p => ({ ...p, category: v }))}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
                <Label className="font-semibold">Description <span className="font-normal text-slate-400">(optional)</span></Label>
                <Textarea
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe what the student did to earn this achievement..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Teacher Comments <span className="font-normal text-slate-400">(for admin review)</span></Label>
                <Textarea
                  value={formData.teacherComments}
                  onChange={e => setFormData(p => ({ ...p, teacherComments: e.target.value }))}
                  placeholder="Add context for the admin reviewer..."
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Evidence Upload */}
              <div className="space-y-3 border-2 border-violet-200 bg-violet-50 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <Label className="font-bold text-slate-900 text-sm">Upload Evidence</Label>
                    <p className="text-xs text-slate-500">Image, PDF, or video — supports the approval request</p>
                  </div>
                </div>

                {formData.evidenceUrl ? (
                  <div className="flex items-center gap-4 p-4 bg-white border-2 border-violet-200 rounded-xl">
                    {formData.evidenceType === 'image' && (
                      <img src={formData.evidenceUrl} alt="Evidence" className="h-16 w-16 object-cover rounded-lg border border-violet-200 flex-shrink-0" />
                    )}
                    {formData.evidenceType !== 'image' && (
                      <div className="h-16 w-16 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="h-8 w-8 text-violet-500" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <p className="text-sm font-semibold text-slate-800">Evidence uploaded</p>
                      </div>
                      <div className="flex gap-3">
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                          className="text-xs text-violet-600 hover:text-violet-800 font-medium underline">
                          Change file
                        </button>
                        <button type="button" onClick={() => setFormData(p => ({ ...p, evidenceUrl: '', evidenceType: '' }))}
                          className="text-xs text-red-500 hover:text-red-700 font-medium underline">
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white gap-2"
                  >
                    {uploadingFile ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="h-4 w-4" /> Upload Evidence File</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Review & Submit */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-1">Review &amp; Submit for Approval</h2>
                <p className="text-sm text-slate-500">This will route the record through the digital custodian approval workflow.</p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Submission Summary</p>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center font-bold text-violet-700 flex-shrink-0">
                      {formData.selectedStudent?.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{formData.selectedStudent?.name}</p>
                      <p className="text-xs text-slate-500">{formData.selectedClass?.name}</p>
                    </div>
                  </div>
                  <div className="h-px bg-slate-200" />
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Achievement</p>
                    <p className="font-bold text-slate-900 text-lg">{formData.title}</p>
                    {formData.description && <p className="text-sm text-slate-600 mt-1">{formData.description}</p>}
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <Badge variant="outline" className="border-violet-200 text-violet-700">{formData.category}</Badge>
                    <Badge variant="outline" className="border-slate-200 text-slate-600">{formData.dateAchieved}</Badge>
                    {formData.evidenceUrl && <Badge className="bg-green-100 text-green-700 border-green-200" variant="outline">✓ Evidence attached</Badge>}
                  </div>
                  {formData.teacherComments && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-blue-700 mb-1">Teacher Comments</p>
                      <p className="text-sm text-blue-800">{formData.teacherComments}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Workflow note */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-amber-800">⚠️ Important: You must also sign this record</p>
                <p className="text-sm text-amber-700">
                  After submitting, you will be taken to the record detail page where you must apply your digital signature. The record then routes to admin for final approval before the NFT can be minted.
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <Checkbox
                  id="confirm"
                  checked={formData.confirmed}
                  onCheckedChange={v => setFormData(p => ({ ...p, confirmed: v }))}
                  className="mt-0.5"
                />
                <label htmlFor="confirm" className="text-sm text-slate-700 cursor-pointer leading-relaxed">
                  I confirm this achievement is accurate. I understand it will go through a multi-step approval process before being permanently recorded on the blockchain. Submitting for <strong>{formData.selectedStudent?.name}</strong>.
                </label>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-6 mt-6 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(s => Math.max(s - 1, 1))}
              disabled={currentStep === 1}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {currentStep < 3 ? (
              <Button onClick={handleNext} className="gap-2 bg-slate-900 hover:bg-slate-700">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmitForApproval}
                disabled={!formData.confirmed}
                className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg disabled:opacity-40"
              >
                <ClipboardCheck className="h-4 w-4" /> Submit For Approval
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