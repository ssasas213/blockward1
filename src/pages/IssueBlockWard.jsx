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
import IssueStepper from '@/components/blockwards/IssueStepper';
import {
  ArrowLeft, ArrowRight, Loader2, CheckCircle2, Award,
  BookOpen, User, AlertTriangle, Upload, ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const CATEGORIES = ['Academic', 'Sports', 'Arts', 'Leadership', 'Community', 'Innovation'];
const RARITIES = ['Common', 'Rare', 'Epic', 'Legendary'];
const EMOJIS = ['🏆', '⭐', '🎓', '📚', '🎨', '🏅', '💡', '🔥', '✨', '🌟', '👑', '🎯'];

const RARITY_GRADIENTS = {
  Common: 'from-slate-400 to-slate-600',
  Rare: 'from-blue-500 to-indigo-600',
  Epic: 'from-purple-500 to-violet-700',
  Legendary: 'from-amber-400 to-orange-600',
};

function PreviewCard({ formData }) {
  const gradient = RARITY_GRADIENTS[formData.rarity] || RARITY_GRADIENTS.Common;
  const imageUrl = formData.imageUrl;
  return (
    <div className="rounded-2xl overflow-hidden border-2 border-violet-200 shadow-xl">
      <div
        className={`h-44 relative flex flex-col justify-between p-5 ${!imageUrl ? `bg-gradient-to-br ${gradient}` : ''}`}
        style={imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
        {imageUrl && <div className="absolute inset-0 bg-black/40" />}
        <div className="flex items-start justify-between relative z-10">
          <span className="text-5xl leading-none">{!imageUrl ? (formData.icon || '🏆') : ''}</span>
          <span className="bg-white/25 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-white/30">
            {formData.rarity || 'Common'}
          </span>
        </div>
        <div className="relative z-10">
          <h3 className="text-white font-bold text-lg leading-tight drop-shadow-md">
            {formData.title || 'Award Title'}
          </h3>
        </div>
      </div>
      <div className="bg-white p-4 space-y-2">
        <div className="flex gap-2 flex-wrap">
          {formData.category && (
            <Badge variant="outline" className="text-violet-700 border-violet-200">{formData.category}</Badge>
          )}
          {formData.selectedStudent && (
            <Badge variant="secondary">👤 {formData.selectedStudent.name}</Badge>
          )}
        </div>
        {formData.description && (
          <p className="text-xs text-slate-500 line-clamp-2">{formData.description}</p>
        )}
        <p className="text-xs text-slate-400 pt-1 border-t border-slate-100">⛓️ Permanently stored on blockchain</p>
      </div>
    </div>
  );
}

function IssueBlockWardContent() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [profile, setProfile] = useState(null);
  const [schoolId, setSchoolId] = useState(null);
  const [myClasses, setMyClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueSuccess, setIssueSuccess] = useState(false);
  const [issueError, setIssueError] = useState(null);
  const [blockchainData, setBlockchainData] = useState(null);

  const [formData, setFormData] = useState({
    selectedStudent: null,
    selectedClass: null,
    title: '',
    description: '',
    category: '',
    rarity: 'Common',
    icon: '🏆',
    confirmed: false,
    imageUrl: '',
  });

  // CRITICAL: ref must be defined at top level, never inside conditionals
  const imageInputRef = useRef(null);

  useEffect(() => { loadContext(); }, []);

  const loadContext = async () => {
    try {
      const user = await base44.auth.me();
      if (!user) return;
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      const p = profiles[0] || null;
      setProfile(p);
      const sid = p?.school_id || null;
      setSchoolId(sid);

      let classes = [];
      if (p?.user_type === 'admin') {
        classes = sid
          ? await base44.entities.Class.filter({ school_id: sid })
          : await base44.entities.Class.list();
      } else {
        const memberships = await base44.entities.StaffMembership.filter({ user_email: user.email });
        const membership = memberships[0];
        if (membership?.class_ids?.length > 0) {
          const all = await base44.entities.Class.list();
          classes = all.filter(c => membership.class_ids.includes(c.id));
        } else {
          classes = await base44.entities.Class.filter({ teacher_email: user.email });
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

  const openFilePicker = () => {
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
      imageInputRef.current.click();
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(p => ({ ...p, imageUrl: file_url }));
      toast.success('Image uploaded successfully!');
    } catch (err) {
      toast.error('Image upload failed. Please try again.');
    } finally {
      setUploadingImage(false);
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
    }
    setCurrentStep(s => Math.min(s + 1, 3));
  };

  const handleIssue = async () => {
    if (!formData.confirmed) { toast.error('Please tick the confirmation checkbox'); return; }
    setIssuing(true);
    try {
      const response = await base44.functions.invoke('issueBlockward', {
        studentId: formData.selectedStudent.id,
        title: formData.title,
        category: formData.category,
        description: formData.description,
        classId: formData.selectedClass?.id,
        schoolId,
        imageUrl: formData.imageUrl || null,
      });
      const data = response.data;
      if (!data.ok) throw new Error(data.message || data.error || 'Failed to issue BlockWard');
      setBlockchainData({ mintTxHash: data.mintTxHash, tokenId: data.tokenId });
      setIssueSuccess(true);
      toast.success('BlockWard issued successfully!');
    } catch (error) {
      setIssueError(error.message || 'Failed to issue BlockWard.');
    } finally {
      setIssuing(false);
    }
  };

  // ── Loading ──
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
    </div>
  );

  // ── Success ──
  if (issueSuccess) return (
    <div className="max-w-2xl mx-auto py-12">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="border-0 shadow-2xl">
          <CardContent className="p-12 text-center">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">BlockWard Issued!</h2>
            <p className="text-slate-500 mb-8">
              <strong className="text-slate-800">{formData.selectedStudent?.name}</strong> received "<strong className="text-slate-800">{formData.title}</strong>"
            </p>
            {blockchainData && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8 space-y-2 text-left">
                {blockchainData.tokenId && (
                  <p className="text-xs text-slate-500">Token ID: <span className="font-mono font-semibold text-slate-900">#{blockchainData.tokenId}</span></p>
                )}
                {blockchainData.mintTxHash && (
                  <>
                    <p className="text-xs text-slate-500 break-all">TX: <span className="font-mono text-slate-700">{blockchainData.mintTxHash}</span></p>
                    <a href={`https://sepolia.etherscan.io/tx/${blockchainData.mintTxHash}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800 font-medium">
                      View on Sepolia Etherscan →
                    </a>
                  </>
                )}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate(createPageUrl('TeacherBlockWards'))}>
                View All BlockWards
              </Button>
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25"
                onClick={() => window.location.reload()}>
                <Award className="h-4 w-4 mr-2" />Issue Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );

  // ── Minting ──
  if (issuing) return (
    <div className="max-w-2xl mx-auto py-12">
      <Card className="border-0 shadow-2xl">
        <CardContent className="p-12 text-center space-y-4">
          <div className="relative mx-auto w-20 h-20">
            <Loader2 className="h-20 w-20 animate-spin text-violet-200 absolute inset-0" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Award className="h-8 w-8 text-violet-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Minting on blockchain...</h2>
          <p className="text-slate-500">This may take 15–30 seconds. Please don't close this page.</p>
          <div className="flex justify-center gap-1.5 pt-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-2 w-2 rounded-full bg-violet-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ── Error ──
  if (issueError) return (
    <div className="max-w-2xl mx-auto py-12">
      <Card className="border-0 shadow-2xl">
        <CardContent className="p-12 text-center">
          <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Couldn't Issue BlockWard</h2>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8 text-left">
            <p className="text-sm text-red-700 font-mono break-all">{issueError}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => setIssueError(null)}>Try Again</Button>
            <Button variant="ghost" onClick={() => navigate(createPageUrl('TeacherBlockWards'))}>Back to Dashboard</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ── Main Form ──
  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Hidden file input — always in DOM, never inside conditionals */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        className="hidden"
        onChange={handleImageChange}
      />

      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('TeacherBlockWards'))}
          className="hover:bg-slate-100 rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Issue a BlockWard</h1>
          <p className="text-slate-500 mt-0.5">Permanently recognise a student achievement on-chain</p>
        </div>
      </div>

      <IssueStepper currentStep={currentStep} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* ── Form Card ── */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-xl shadow-slate-200/60">
            <CardContent className="p-8">

              {/* Step 1: Select Class & Student */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-1">Select Class &amp; Student</h2>
                    <p className="text-sm text-slate-500">Choose which student to recognise.</p>
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
                              <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                              Loading students...
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

              {/* Step 2: Award Details */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-1">Award Details</h2>
                    <p className="text-sm text-slate-500">
                      Awarding to <strong className="text-slate-700">{formData.selectedStudent?.name}</strong>
                      {formData.selectedClass?.name && <> in <strong className="text-slate-700">{formData.selectedClass.name}</strong></>}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold">Title *</Label>
                    <Input
                      value={formData.title}
                      onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Perfect Attendance, Top Scorer, Most Creative"
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold">Description <span className="font-normal text-slate-400">(optional)</span></Label>
                    <Textarea
                      value={formData.description}
                      onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                      placeholder="Describe what the student did to earn this award..."
                      rows={3}
                      className="resize-none"
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
                      <Label className="font-semibold">Rarity</Label>
                      <Select value={formData.rarity} onValueChange={v => setFormData(p => ({ ...p, rarity: v }))}>
                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>{RARITIES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="font-semibold">Icon <span className="font-normal text-slate-400">(used if no image uploaded)</span></Label>
                    <div className="grid grid-cols-6 gap-2">
                      {EMOJIS.map(e => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => setFormData(p => ({ ...p, icon: e }))}
                          className={`text-2xl p-2.5 rounded-xl border-2 transition-all duration-150 ${
                            formData.icon === e
                              ? 'border-violet-500 bg-violet-50 scale-110 shadow-md shadow-violet-200'
                              : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* NFT Image Upload */}
                  <div className="space-y-3 border-t-2 border-violet-100 pt-5 bg-violet-50/40 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <Label className="font-bold text-slate-900 text-sm">Upload Custom NFT Image</Label>
                        <p className="text-xs text-slate-500">Optional — replaces the icon above with your own image</p>
                      </div>
                    </div>

                    {formData.imageUrl ? (
                      <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-violet-50 to-indigo-50 border-2 border-violet-200 rounded-xl">
                        <img
                          src={formData.imageUrl}
                          alt="NFT preview"
                          className="h-20 w-20 object-cover rounded-xl border-2 border-violet-300 shadow-md flex-shrink-0"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <p className="text-sm font-semibold text-slate-800">Image ready</p>
                          </div>
                          <p className="text-xs text-slate-500 mb-3">This image will be embedded in the NFT metadata</p>
                          <div className="flex gap-3">
                            <button type="button" onClick={openFilePicker}
                              className="text-xs text-violet-600 hover:text-violet-800 font-medium underline underline-offset-2">
                              Change image
                            </button>
                            <button type="button" onClick={() => setFormData(p => ({ ...p, imageUrl: '' }))}
                              className="text-xs text-red-500 hover:text-red-700 font-medium underline underline-offset-2">
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={openFilePicker}
                        className="flex flex-col items-center justify-center gap-3 h-32 border-2 border-dashed border-violet-300 rounded-xl cursor-pointer bg-gradient-to-br from-violet-50 to-indigo-50 hover:border-violet-500 hover:from-violet-100 hover:to-indigo-100 transition-all duration-200 group"
                      >
                        {uploadingImage ? (
                          <>
                            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                            <span className="text-sm font-medium text-violet-600">Uploading...</span>
                          </>
                        ) : (
                          <>
                            <div className="h-12 w-12 rounded-full bg-white group-hover:bg-violet-100 flex items-center justify-center shadow-sm transition-colors">
                              <Upload className="h-6 w-6 text-violet-500" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-semibold text-violet-700">Click to upload NFT image</p>
                              <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, GIF, WebP · Max 10MB</p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Review & Issue */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-1">Review &amp; Issue</h2>
                    <p className="text-sm text-slate-500">Double-check everything — this cannot be undone.</p>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Award Summary</p>
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
                        <Badge variant="outline" className="border-amber-200 text-amber-700">{formData.rarity}</Badge>
                        <span className="text-xl">{formData.icon}</span>
                        {formData.imageUrl && (
                          <img src={formData.imageUrl} alt="" className="h-8 w-8 rounded-lg object-cover border border-violet-200" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <Checkbox
                      id="confirm"
                      checked={formData.confirmed}
                      onCheckedChange={v => setFormData(p => ({ ...p, confirmed: v }))}
                      className="mt-0.5"
                    />
                    <label htmlFor="confirm" className="text-sm text-amber-900 cursor-pointer leading-relaxed">
                      I confirm this award is accurate and understand it will be <strong>permanently recorded on the blockchain</strong> and cannot be deleted. Awarding to <strong>{formData.selectedStudent?.name}</strong>.
                    </label>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
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
                    onClick={handleIssue}
                    disabled={!formData.confirmed}
                    className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25 disabled:opacity-40"
                  >
                    <Award className="h-4 w-4" /> Issue BlockWard
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Preview</p>
          <PreviewCard formData={formData} />
          <div className="p-4 bg-violet-50 border border-violet-100 rounded-xl">
            <p className="text-xs text-violet-700 font-semibold mb-1">⛓️ About BlockWards</p>
            <p className="text-xs text-violet-600 leading-relaxed">
              BlockWards are soulbound NFTs — permanently linked to the student's wallet. They cannot be transferred or deleted once issued.
            </p>
          </div>
        </div>
      </div>
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