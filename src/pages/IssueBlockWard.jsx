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
import BlockWardPreviewCard from '@/components/blockwards/BlockWardPreviewCard';
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, Award, BookOpen, User, AlertTriangle, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const CATEGORIES = ['Academic', 'Sports', 'Arts', 'Leadership', 'Community', 'Innovation'];
const RARITIES = ['Common', 'Rare', 'Epic', 'Legendary'];
const EMOJIS = ['🏆', '⭐', '🎓', '📚', '🎨', '🏅', '💡', '🔥', '✨', '🌟', '👑', '🎯'];

function IssueBlockWardContent() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);

  // Context
  const [profile, setProfile] = useState(null);
  const [schoolId, setSchoolId] = useState(null);

  // Step 1 data
  const [myClasses, setMyClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Form
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef(null);

  // Submit states
  const [issuing, setIssuing] = useState(false);
  const [issueSuccess, setIssueSuccess] = useState(false);
  const [issueError, setIssueError] = useState(null);
  const [blockchainData, setBlockchainData] = useState(null);

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

      // Determine which classes this user can issue awards for
      let classes = [];
      if (p?.user_type === 'admin') {
        // Admin: all classes in their school
        classes = sid
          ? await base44.entities.Class.filter({ school_id: sid })
          : await base44.entities.Class.list();
      } else {
        // Teacher: classes from StaffMembership.class_ids OR legacy teacher_email
        const memberships = await base44.entities.StaffMembership.filter({ user_email: user.email });
        const membership = memberships[0];
        if (membership?.class_ids?.length > 0) {
          const all = await base44.entities.Class.list();
          classes = all.filter(c => membership.class_ids.includes(c.id));
        } else {
          // Legacy fallback
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
      // Try Enrollment entity first (new model)
      const enrollments = await base44.entities.Enrollment.filter({ class_id: classId, status: 'active' });
      let students = [];

      if (enrollments.length > 0) {
        const emails = enrollments.map(e => e.student_email);
        const allProfiles = await base44.entities.UserProfile.list();
        students = allProfiles
          .filter(p => emails.includes(p.user_email) && p.user_type === 'student')
          .map(p => ({
            id: p.id,
            name: `${p.first_name} ${p.last_name}`,
            email: p.user_email,
            gradeLevel: p.grade_level || '',
          }));
      } else {
        // Legacy: class.student_emails
        if (cls?.student_emails?.length > 0) {
          const allProfiles = await base44.entities.UserProfile.list();
          students = allProfiles
            .filter(p => cls.student_emails.includes(p.user_email) && p.user_type === 'student')
            .map(p => ({
              id: p.id,
              name: `${p.first_name} ${p.last_name}`,
              email: p.user_email,
              gradeLevel: p.grade_level || '',
            }));
        }
      }
      setEnrolledStudents(students);
    } catch (e) {
      toast.error('Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(p => ({ ...p, imageUrl: file_url }));
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
    if (currentStep === 2 && (!formData.title || !formData.category)) {
      toast.error('Please fill in Title and Category');
      return;
    }
    setCurrentStep(s => Math.min(s + 1, 3));
  };

  const handleIssue = async () => {
    if (!formData.confirmed) { toast.error('Please confirm the award details'); return; }
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
      setBlockchainData({ mintTxHash: data.mintTxHash, transferTxHash: data.transferTxHash, tokenId: data.tokenId });
      setIssueSuccess(true);
      toast.success('BlockWard issued successfully!');
    } catch (error) {
      setIssueError(error.message || 'Failed to issue BlockWard.');
      toast.error('Failed to issue BlockWard');
    } finally {
      setIssuing(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
    </div>
  );

  if (issueSuccess) return (
    <div className="max-w-2xl mx-auto py-12">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="border-0 shadow-2xl">
          <CardContent className="p-12 text-center">
            <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-3">BlockWard Issued!</h2>
            <p className="text-slate-600 mb-8">{formData.selectedStudent.name} — "{formData.title}"</p>
            {blockchainData && (
              <div className="bg-slate-50 rounded-xl p-6 mb-8 space-y-2 text-left">
                {blockchainData.tokenId && <p className="text-xs text-slate-500">Token ID: <span className="font-mono text-slate-900">#{blockchainData.tokenId}</span></p>}
                {blockchainData.mintTxHash && <p className="text-xs text-slate-500 break-all">TX Hash: <span className="font-mono text-slate-900">{blockchainData.mintTxHash}</span></p>}
                {blockchainData.mintTxHash && (
                  <a href={`https://sepolia.etherscan.io/tx/${blockchainData.mintTxHash}`} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 hover:underline">View on Sepolia Etherscan →</a>
                )}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate(createPageUrl('TeacherBlockWards'))}>View All BlockWards</Button>
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600" onClick={() => window.location.reload()}>
                <Award className="h-4 w-4 mr-2" />Issue Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );

  if (issuing) return (
    <div className="max-w-2xl mx-auto py-12">
      <Card className="border-0 shadow-2xl">
        <CardContent className="p-12 text-center">
          <Loader2 className="h-16 w-16 animate-spin text-violet-600 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Submitting to blockchain...</h2>
          <p className="text-slate-600">Please wait</p>
        </CardContent>
      </Card>
    </div>
  );

  if (issueError) return (
    <div className="max-w-2xl mx-auto py-12">
      <Card className="border-0 shadow-2xl border-red-200">
        <CardContent className="p-12 text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Couldn't Issue BlockWard</h2>
          <p className="text-slate-600 mb-8">{issueError}</p>
          <Button variant="outline" onClick={() => setIssueError(null)}>Try Again</Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('TeacherBlockWards'))}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Issue a BlockWard</h1>
          <p className="text-slate-500 mt-1">Recognize student achievements</p>
        </div>
      </div>

      <IssueStepper currentStep={currentStep} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 md:p-8">

              {/* ── Step 1: Class → Student ── */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-1">Select Class &amp; Student</h2>
                    <p className="text-sm text-slate-500">You can only award students enrolled in your classes.</p>
                  </div>

                  {myClasses.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">No classes assigned to you yet.</p>
                      <p className="text-sm mt-1">Ask an admin to assign you to a class first.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Class *</Label>
                        <Select value={selectedClassId} onValueChange={handleClassSelect}>
                          <SelectTrigger>
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
                        <div className="space-y-2">
                          <Label>Student *</Label>
                          {loadingStudents ? (
                            <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
                              <Loader2 className="h-4 w-4 animate-spin" /> Loading students...
                            </div>
                          ) : enrolledStudents.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 border-2 border-dashed rounded-xl">
                              <User className="h-10 w-10 mx-auto mb-2 opacity-40" />
                              <p className="font-medium">No students enrolled in this class.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {enrolledStudents.map(student => (
                                <button
                                  key={student.id}
                                  onClick={() => setFormData(prev => ({ ...prev, selectedStudent: student }))}
                                  className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                                    formData.selectedStudent?.id === student.id
                                      ? 'border-violet-500 bg-violet-50'
                                      : 'border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                                    formData.selectedStudent?.id === student.id ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {student.name[0]}
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-900">{student.name}</p>
                                    {student.gradeLevel && <p className="text-xs text-slate-500">{student.gradeLevel}</p>}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Step 2: Award Details ── */}
              {currentStep === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-1">Award Details</h2>
                    <p className="text-sm text-slate-500">Awarding to <strong>{formData.selectedStudent?.name}</strong> in {formData.selectedClass?.name}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Perfect Attendance" />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Describe the achievement..." rows={3} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category *</Label>
                      <Select value={formData.category} onValueChange={v => setFormData(p => ({ ...p, category: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Rarity</Label>
                      <Select value={formData.rarity} onValueChange={v => setFormData(p => ({ ...p, rarity: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{RARITIES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Icon</Label>
                    <div className="grid grid-cols-6 gap-2">
                      {EMOJIS.map(e => (
                        <button key={e} type="button" onClick={() => setFormData(p => ({ ...p, icon: e }))}
                          className={`text-2xl p-2 rounded-lg border-2 hover:border-violet-500 transition-all ${formData.icon === e ? 'border-violet-500 bg-violet-50' : 'border-slate-200'}`}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <Label className="text-sm font-semibold text-slate-700">Upload NFT Image <span className="text-violet-500 font-normal">(optional)</span></Label>
                    <input ref={imageInputRef} type="file" accept="image/png,image/jpg,image/jpeg" className="hidden" disabled={uploadingImage} onChange={handleImageUpload} />
                    {formData.imageUrl ? (
                      <div className="flex items-center gap-4 p-4 bg-violet-50 border-2 border-violet-200 rounded-xl">
                        <img src={formData.imageUrl} alt="NFT preview" className="h-20 w-20 object-cover rounded-xl border-2 border-violet-300 shadow-md flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-violet-900 mb-1">Image uploaded ✓</p>
                          <button type="button" onClick={() => setFormData(p => ({ ...p, imageUrl: '' }))} className="text-xs text-red-500 hover:text-red-700 underline">Remove image</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => !uploadingImage && imageInputRef.current?.click()}
                        className="w-full flex flex-col items-center justify-center gap-2 h-24 border-2 border-dashed border-violet-400 rounded-xl bg-violet-50 hover:border-violet-600 hover:bg-violet-100 transition-all"
                      >
                        {uploadingImage ? (
                          <><Loader2 className="h-5 w-5 animate-spin text-violet-500" /><span className="text-sm text-violet-600">Uploading...</span></>
                        ) : (
                          <><Upload className="h-5 w-5 text-violet-500" /><span className="text-sm font-medium text-violet-700">Click to upload image</span><span className="text-xs text-slate-400">PNG, JPG recommended</span></>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Step 3: Review ── */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-1">Review &amp; Issue</h2>
                    <p className="text-sm text-slate-500">Confirm the details before permanently issuing</p>
                  </div>

                  <div className="p-6 bg-slate-50 rounded-xl space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Awarding To</p>
                      <p className="font-semibold text-slate-900">{formData.selectedStudent?.name}</p>
                      <p className="text-sm text-slate-500">{formData.selectedClass?.name}</p>
                    </div>
                    <div className="h-px bg-slate-200" />
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Achievement</p>
                      <p className="font-semibold text-slate-900">{formData.title}</p>
                      {formData.description && <p className="text-sm text-slate-600 mt-1">{formData.description}</p>}
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <Badge variant="outline">{formData.category}</Badge>
                      <Badge variant="outline">{formData.rarity}</Badge>
                      <span className="text-xl">{formData.icon}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-violet-50 rounded-lg">
                    <Checkbox
                      id="confirm"
                      checked={formData.confirmed}
                      onCheckedChange={v => setFormData(p => ({ ...p, confirmed: v }))}
                    />
                    <label htmlFor="confirm" className="text-sm text-violet-900 cursor-pointer">
                      I confirm this award is accurate and should be permanently issued to {formData.selectedStudent?.name}
                    </label>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-6 mt-6 border-t">
                <Button variant="outline" onClick={() => setCurrentStep(s => Math.max(s - 1, 1))} disabled={currentStep === 1}>
                  <ArrowLeft className="h-4 w-4 mr-2" />Back
                </Button>
                {currentStep < 3 ? (
                  <Button onClick={handleNext}>
                    Next <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={handleIssue} disabled={!formData.confirmed} className="bg-gradient-to-r from-violet-600 to-indigo-600">
                    <Award className="h-4 w-4 mr-2" />Issue BlockWard
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Preview</h3>
            {formData.title || formData.category ? (
              <BlockWardPreviewCard blockWard={formData} />
            ) : (
              <Card className="border-2 border-dashed border-slate-200">
                <CardContent className="p-8 text-center">
                  <Award className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-sm text-slate-500">Preview appears as you fill in details</p>
                </CardContent>
              </Card>
            )}
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