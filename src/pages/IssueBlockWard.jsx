import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import RoleGuard from '@/components/auth/RoleGuard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, CheckCircle2, Award, AlertTriangle, Shield, Check, Pencil, Sparkles, SendHorizonal, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import StudentPicker from '@/components/blockwards/StudentPicker';
import BlockWardPreviewCard from '@/components/blockwards/BlockWardPreviewCard';
import SignatureStep from '@/components/blockwards/SignatureStep';
import CustomAwardForm from '@/components/blockwards/CustomAwardForm';
import EvidenceUpload from '@/components/blockwards/EvidenceUpload';
import { useEffectiveRole } from '@/lib/useEffectiveRole';

// ─── Stepper ──────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, name: 'Select Student' },
  { id: 2, name: 'Choose Award' },
  { id: 3, name: 'Upload Evidence' },
  { id: 4, name: 'Teacher Signature' },
  { id: 5, name: 'Review & Submit' },
];

function Stepper({ currentStep }) {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center flex-1">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold transition-all
                ${currentStep > step.id ? 'bg-success text-success-foreground' :
                  currentStep === step.id ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
                  'bg-muted text-muted-foreground'}`}>
                {currentStep > step.id ? <Check className="h-5 w-5" /> : step.id}
              </div>
              <p className={`text-xs mt-2 font-medium text-center ${currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.name}
              </p>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 mt-[-20px] transition-all ${currentStep > step.id ? 'bg-success' : 'bg-border'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Award Picker ─────────────────────────────────────────────────────────────
const CATEGORIES = ['academic', 'sports', 'arts', 'leadership', 'community', 'special'];
const CATEGORY_ICONS = { academic: '📚', sports: '🏅', arts: '🎨', leadership: '🌟', community: '🤝', special: '✨' };

function AwardPicker({ awardTypes, selectedAward, onSelect, onCustom, loadError }) {
  const [catFilter, setCatFilter] = useState('all');
  const filtered = catFilter === 'all' ? awardTypes : awardTypes.filter(a => a.category === catFilter);
  const activeCats = CATEGORIES.filter(c => awardTypes.some(a => a.category === c));

  if (loadError) {
    return (
      <div className="text-center py-10 bg-red-50 rounded-xl border border-red-200">
        <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-red-700 font-semibold">Failed to load awards</p>
        <p className="text-red-500 text-sm mt-1">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create Custom Award card */}
      <button
        type="button"
        onClick={onCustom}
        className="w-full p-4 rounded-xl border-2 border-dashed border-violet-400 bg-violet-50 hover:bg-violet-100 transition-all text-left flex items-center gap-3"
      >
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-violet-700">Create Custom Award</p>
          <p className="text-xs text-violet-500">Design a unique award for this specific achievement</p>
        </div>
      </button>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCatFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
            ${catFilter === 'all' ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600 hover:border-violet-400'}`}>
          All ({awardTypes.length})
        </button>
        {activeCats.map(c => (
          <button key={c} type="button" onClick={() => setCatFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
              ${catFilter === c ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600 hover:border-violet-400'}`}>
            {CATEGORY_ICONS[c]} {c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {awardTypes.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-slate-500 font-medium">No award templates available</p>
          <p className="text-slate-400 text-sm mt-1">Use "Create Custom Award" above to design your own.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
          {filtered.map(award => {
            const isSelected = selectedAward?.id === award.id;
            return (
              <button key={award.id} type="button" onClick={() => onSelect(award)}
                className={`p-4 rounded-xl border-2 text-left transition-all
                  ${isSelected ? 'border-violet-500 bg-violet-50 shadow-md' : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{CATEGORY_ICONS[award.category] || '🏆'}</span>
                      <p className="font-semibold text-slate-900 truncate">{award.title}</p>
                    </div>
                    {award.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{award.description}</p>}
                  </div>
                  {isSelected && <CheckCircle2 className="h-5 w-5 text-violet-500 flex-shrink-0 mt-0.5" />}
                </div>
                {award.category && (
                  <Badge variant="outline" className="text-xs mt-2 capitalize">{award.category}</Badge>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────
function IssueBlockWardContent() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [sigProfile, setSigProfile] = useState(null);
  const [schoolId, setSchoolId] = useState(null);
  const [schoolName, setSchoolName] = useState('');
  const [students, setStudents] = useState([]);
  const [teacherClasses, setTeacherClasses] = useState([]);
  const [debugInfo, setDebugInfo] = useState(null);
  const [awardTypes, setAwardTypes] = useState([]);
  const [awardLoadError, setAwardLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedAward, setSelectedAward] = useState(null);
  const [isCustomAward, setIsCustomAward] = useState(false);
  const [customAwardData, setCustomAwardData] = useState({
    title: '', category: 'academic', description: '', points: 0, icon: '🏆', color: '#7c3aed', nftImageUrl: ''
  });
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [dateAchieved, setDateAchieved] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceType, setEvidenceType] = useState('');
  const [certificateUrl, setCertificateUrl] = useState('');
  const [certificateType, setCertificateType] = useState('');
  const [teacherNotes, setTeacherNotes] = useState('');
  const [teacherSignature, setTeacherSignature] = useState(null);
  const [teacherSignedAt, setTeacherSignedAt] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const { effectiveRole, effectiveEmail, effectiveName } = useEffectiveRole();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (!currentUser) return;
      setUser(currentUser);

      const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      const p = profiles[0] || null;
      setProfile(p);
      const sid = p?.school_id || null;
      setSchoolId(sid);

      // In Test Mode the effective teacher identity is the persona's email/name —
      // use those so class/student/signature lookups match the persona's data.
      const teacherEmail = effectiveEmail || currentUser.email;

      // Load signature profile for teacher
      const sigProfiles = await base44.entities.SignatureProfile.filter({ user_email: teacherEmail });
      setSigProfile(sigProfiles[0] || null);

      if (sid) {
        const schools = await base44.entities.School.filter({ id: sid });
        if (schools[0]) setSchoolName(schools[0].name);
      }

      const rosterRes = await base44.functions.invoke('getMyStudents', { teacher_email: teacherEmail });
      const rosterData = rosterRes.data || rosterRes;
      if (rosterData?.error) throw new Error(rosterData.error);
      const classData = rosterData?.classes || [];
      setTeacherClasses(classData);

      const studentList = (rosterData?.students || []).map(sp => ({
        id: sp.id,
        name: `${sp.first_name || ''} ${sp.last_name || ''}`.trim() || sp.user_email,
        email: sp.user_email,
        className: sp.class_name || 'Student',
        classId: sp.class_id || null,
        avatarUrl: sp.avatar_url || null,
      }));

      setStudents(studentList);
      setDebugInfo({
        userId: currentUser.id,
        teacherEmail,
        schoolId: sid,
        classCount: classData.length,
        studentCount: studentList.length,
      });

      setAwardLoadError(null);
      let awards = await base44.entities.AwardTypes.filter({ is_active: true });
      if (awards.length === 0) {
        awards = await base44.entities.AwardTypes.list();
      }
      setAwardTypes(awards);
    } catch (e) {
      console.error('loadData error:', e);
      const msg = e.message || 'Unknown error';
      toast.error(`Failed to load data: ${msg}`);
      setAwardLoadError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !selectedStudent) { toast.error('Please select a student'); return; }
    if (currentStep === 2) {
      if (isCustomAward && !customAwardData.title) { toast.error('Please enter a custom award title'); return; }
      if (!isCustomAward && !selectedAward) { toast.error('Please select an award'); return; }
    }
    if (currentStep === 3 && !evidenceUrl) { toast.error('Please upload at least one evidence file'); return; }
    if (currentStep === 4 && !teacherSignature) { toast.error('Please draw your signature before continuing'); return; }
    setCurrentStep(s => Math.min(s + 1, 5));
  };

  const handleBack = () => setCurrentStep(s => Math.max(s - 1, 1));

  const handleSelectTemplate = (award) => {
    setSelectedAward(award);
    setIsCustomAward(false);
    setCustomTitle(award.title);
    setCustomDescription(award.description || '');
  };

  const handleStartCustom = () => {
    setIsCustomAward(true);
    setSelectedAward(null);
    setCustomTitle('');
    setCustomDescription('');
  };

  const handleCertificateUpload = async (file) => {
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCertificateUrl(file_url);
      setCertificateType(file.type.startsWith('image/') ? 'image' : 'file');
      toast.success('Certificate uploaded');
    } catch (e) {
      toast.error('Failed to upload certificate');
    }
  };

  const handleSubmit = async () => {
    if (!confirmed) { toast.error('Please tick the confirmation checkbox'); return; }
    if (!teacherSignature) { toast.error('Teacher signature is required'); return; }
    if (!evidenceUrl) { toast.error('Evidence file is required'); return; }
    if (!schoolId) { toast.error('School not found — cannot submit'); return; }

    setSubmitting(true);
    try {
      // 1. Upload teacher signature as a file
      let signatureUrl = teacherSignature;
      try {
        const blob = await (await fetch(teacherSignature)).blob();
        const sigFile = new File([blob], 'teacher-signature.png', { type: 'image/png' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file: sigFile });
        signatureUrl = file_url;
      } catch (_) { /* fall back to base64 */ }

      // 2. Determine award fields
      const finalTitle = isCustomAward ? customAwardData.title : (customTitle || selectedAward?.title);
      const finalCategory = isCustomAward ? customAwardData.category : (selectedAward?.category || 'special');
      const finalDescription = isCustomAward ? customAwardData.description : (customDescription || selectedAward?.description || '');

      // 3. Create StudentRecord with status "draft"
      const recordData = {
        school_id: schoolId,
        student_email: selectedStudent.email,
        student_name: selectedStudent.name,
        student_id: selectedStudent.id,
        class_id: selectedStudent.classId || null,
        class_name: selectedStudent.className || null,
        // teacher_email must match the controller's real email to pass create-RLS
        // (no admin bypass on StudentRecord.create). recordWorkflow then overwrites
        // teacher_email/name/id with the persona's values via the service role.
        teacher_email: user.email,
        teacher_name: effectiveName || `${profile.first_name} ${profile.last_name}`,
        title: finalTitle,
        category: finalCategory,
        description: finalDescription,
        date_achieved: dateAchieved || null,
        file_url: evidenceUrl,
        file_type: evidenceType,
        certificate_url: certificateUrl || null,
        teacher_notes: teacherNotes || null,
        teacher_signature_url: signatureUrl,
        status: 'draft',
      };

      // Add custom award fields
      if (isCustomAward) {
        recordData.is_custom_award = true;
        recordData.custom_award_icon = customAwardData.icon;
        recordData.custom_award_color = customAwardData.color;
        recordData.points = customAwardData.points || 0;
        recordData.custom_nft_image_url = customAwardData.nftImageUrl || null;
      } else {
        recordData.award_type_id = selectedAward?.id || null;
        recordData.award_type_title = selectedAward?.title || null;
        recordData.is_custom_award = false;
      }

      const record = await base44.entities.StudentRecord.create(recordData);

      // 4. Teacher submits on behalf of student: draft → awaiting_teacher_signature
      const submitRes = await base44.functions.invoke('recordWorkflow', {
        action: 'teacherSubmitRecord',
        recordId: record.id,
      });
      if (!submitRes.data?.ok) throw new Error(submitRes.data?.error || 'Failed to submit record');

      // 5. Teacher signs: awaiting_teacher_signature → awaiting_admin_signature
      const sigDisplayName = sigProfile?.display_name || effectiveName || `${profile.first_name} ${profile.last_name}`;
      const sigTitle = sigProfile?.title || '';
      const signRes = await base44.functions.invoke('recordWorkflow', {
        action: 'teacherSignRecord',
        recordId: record.id,
        signatureData: {
          value: signatureUrl,
          type: 'drawn',
          display_name: sigDisplayName,
          title: sigTitle,
        },
      });
      if (!signRes.data?.ok) throw new Error(signRes.data?.error || 'Failed to sign record');

      setSubmitSuccess(true);
      toast.success('Achievement record submitted for admin approval!');
    } catch (error) {
      toast.error(error.message || 'Failed to submit record');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setSelectedStudent(null);
    setSelectedAward(null);
    setIsCustomAward(false);
    setCustomAwardData({ title: '', category: 'academic', description: '', points: 0, icon: '🏆', color: '#7c3aed', nftImageUrl: '' });
    setCustomTitle('');
    setCustomDescription('');
    setDateAchieved('');
    setEvidenceUrl('');
    setEvidenceType('');
    setCertificateUrl('');
    setCertificateType('');
    setTeacherNotes('');
    setTeacherSignature(null);
    setTeacherSignedAt(null);
    setConfirmed(false);
    setSubmitSuccess(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
    </div>
  );

  /* role enforced by RoleGuard at the route layer */

  if (submitSuccess) return (
    <div className="max-w-2xl mx-auto py-12">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="border-0 shadow-2xl">
          <CardContent className="p-12 text-center">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
              <SendHorizonal className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Submitted for Approval!</h2>
            <p className="text-slate-500 mb-8">
              Your achievement record has been signed and sent to the school administrator for final approval.
              No NFT will be minted until the admin reviews and signs.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 gap-2" onClick={() => navigate(createPageUrl('TeacherRecords'))}>
                <Shield className="h-4 w-4" /> View My Submissions
              </Button>
              <Button variant="outline" onClick={resetForm}>Create Another</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );

  // Preview data
  const previewTitle = isCustomAward ? customAwardData.title : (customTitle || selectedAward?.title || '');
  const previewCategory = isCustomAward ? customAwardData.category : (selectedAward?.category || 'special');
  const previewDescription = isCustomAward ? customAwardData.description : (customDescription || selectedAward?.description || '');
  const previewIcon = isCustomAward ? customAwardData.icon : (CATEGORY_ICONS[previewCategory] || '🏆');

  const blockWardPreview = (previewTitle || selectedAward) ? {
    title: previewTitle,
    description: previewDescription,
    category: previewCategory,
    rarity: 'Common',
    icon: previewIcon,
  } : null;

  const canGoNext =
    (currentStep === 1 && !!selectedStudent) ||
    (currentStep === 2 && (isCustomAward ? !!customAwardData.title : !!selectedAward)) ||
    (currentStep === 3 && !!evidenceUrl) ||
    (currentStep === 4 && !!teacherSignature);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('TeacherBlockWards'))} className="hover:bg-slate-100 rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Create Achievement Record</h1>
          <p className="text-slate-500 mt-0.5">Recognize a student achievement for admin approval</p>
        </div>
      </div>

      <Stepper currentStep={currentStep} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main card */}
        <Card className="lg:col-span-2 border-0 shadow-xl shadow-slate-200/60">
          <CardContent className="p-8">

            {/* Step 1: Select Student */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-1">Select Student</h2>
                  <p className="text-sm text-slate-500">Choose the student to receive this achievement.</p>
                </div>
                <StudentPicker
                  students={students}
                  classes={teacherClasses}
                  selectedStudent={selectedStudent}
                  onSelect={setSelectedStudent}
                  debugInfo={debugInfo}
                />
              </div>
            )}

            {/* Step 2: Choose Award */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-1">Choose Award</h2>
                  <p className="text-sm text-slate-500">Select a template or create a custom award for <strong className="text-slate-700">{selectedStudent?.name}</strong>.</p>
                </div>

                {isCustomAward ? (
                  <div className="space-y-4">
                    <CustomAwardForm data={customAwardData} onChange={setCustomAwardData} />
                    <Button variant="outline" onClick={() => { setIsCustomAward(false); }} className="gap-2">
                      <ArrowLeft className="h-4 w-4" /> Back to Templates
                    </Button>
                  </div>
                ) : (
                  <>
                    <AwardPicker
                      awardTypes={awardTypes}
                      selectedAward={selectedAward}
                      onSelect={handleSelectTemplate}
                      onCustom={handleStartCustom}
                      loadError={awardLoadError}
                    />

                    {selectedAward && (
                      <div className="mt-6 space-y-4 p-5 bg-violet-50 border border-violet-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-1">
                          <Pencil className="h-4 w-4 text-violet-600" />
                          <p className="text-sm font-semibold text-violet-700">Personalise this Award</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Custom Title</label>
                          <Input
                            value={customTitle}
                            onChange={e => setCustomTitle(e.target.value)}
                            placeholder="e.g. Top in Mathematics — Year 9 Term 3"
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Custom Description</label>
                          <Textarea
                            value={customDescription}
                            onChange={e => setCustomDescription(e.target.value)}
                            placeholder="Awarded for achieving the highest mark in Year 9 Mathematics."
                            rows={3}
                            className="bg-white resize-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Date Achieved</label>
                          <Input
                            type="date"
                            value={dateAchieved}
                            onChange={e => setDateAchieved(e.target.value)}
                            className="bg-white max-w-48"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Date achieved for custom awards */}
                {isCustomAward && (
                  <div className="p-5 bg-violet-50 border border-violet-200 rounded-xl space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Date Achieved</label>
                      <Input
                        type="date"
                        value={dateAchieved}
                        onChange={e => setDateAchieved(e.target.value)}
                        className="bg-white max-w-48"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Upload Evidence */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-1">Upload Evidence</h2>
                  <p className="text-sm text-slate-500">Upload at least one evidence file. This is required before signing.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Evidence File (Required) *</label>
                  <EvidenceUpload
                    evidenceUrl={evidenceUrl}
                    evidenceType={evidenceType}
                    onUpload={(url, type) => { setEvidenceUrl(url); setEvidenceType(type); }}
                    onClear={() => { setEvidenceUrl(''); setEvidenceType(''); }}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Certificate / Supporting Document (Optional)</label>
                  {certificateUrl ? (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <FileText className="h-5 w-5 text-violet-600" />
                      <a href={certificateUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 hover:underline flex-1">View certificate</a>
                      <Button variant="ghost" size="sm" onClick={() => { setCertificateUrl(''); setCertificateType(''); }} className="text-red-500">Remove</Button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-colors">
                      <Upload className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-600">Upload certificate (PDF, image, or document)</span>
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        className="hidden"
                        onChange={e => e.target.files?.[0] && handleCertificateUpload(e.target.files[0])}
                      />
                    </label>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Notes for Admin (Optional)</label>
                  <Textarea
                    value={teacherNotes}
                    onChange={e => setTeacherNotes(e.target.value)}
                    placeholder="Add any context or notes for the reviewing administrator..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>
            )}

            {/* Step 4: Teacher Signature */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-1">Teacher Signature</h2>
                  <p className="text-sm text-slate-500">Sign below to endorse this achievement. Your signature will be attached to the record sent for admin approval.</p>
                </div>
                <SignatureStep
                  profile={profile}
                  schoolName={schoolName}
                  signature={teacherSignature}
                  signedAt={teacherSignedAt}
                  onSign={(sig, ts) => { setTeacherSignature(sig); setTeacherSignedAt(ts); toast.success('Signature captured!'); }}
                  onClear={() => { setTeacherSignature(null); setTeacherSignedAt(null); }}
                />
              </div>
            )}

            {/* Step 5: Review & Submit */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-1">Review & Submit</h2>
                  <p className="text-sm text-slate-500">Confirm the details before submitting for admin approval. No NFT will be minted until the admin signs.</p>
                </div>

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                  <div className="p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Awarding To</p>
                    <p className="font-bold text-slate-900 text-lg">{selectedStudent?.name}</p>
                    <p className="text-sm text-slate-500">{selectedStudent?.className}</p>
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Achievement</p>
                    <p className="font-bold text-slate-900 text-lg">{previewTitle}</p>
                    {previewDescription && <p className="text-sm text-slate-500 mt-1">{previewDescription}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge variant="outline" className="text-xs capitalize">{previewCategory}</Badge>
                      {isCustomAward ? (
                        <Badge className="text-xs bg-violet-100 text-violet-700">Custom Award</Badge>
                      ) : (
                        selectedAward && customTitle !== selectedAward.title && (
                          <p className="text-xs text-violet-500 mt-1 w-full">Based on: {selectedAward?.title}</p>
                        )
                      )}
                      {isCustomAward && customAwardData.points > 0 && (
                        <Badge className="text-xs bg-amber-100 text-amber-700">{customAwardData.points} pts</Badge>
                      )}
                    </div>
                    {dateAchieved && (
                      <p className="text-xs text-slate-500 mt-2">Date achieved: {dateAchieved}</p>
                    )}
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Evidence</p>
                    {evidenceUrl && (
                      evidenceType === 'image' || evidenceUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img src={evidenceUrl} alt="Evidence" className="max-h-32 rounded-lg border border-slate-200" />
                      ) : (
                        <a href={evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 hover:underline flex items-center gap-1">
                          <FileText className="h-4 w-4" /> View evidence file
                        </a>
                      )
                    )}
                    {certificateUrl && (
                      <p className="text-xs text-slate-500 mt-2">Certificate attached ✓</p>
                    )}
                  </div>
                  {teacherNotes && (
                    <div className="p-5">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Notes for Admin</p>
                      <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{teacherNotes}</p>
                    </div>
                  )}
                  <div className="p-5">
                    <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-2">Teacher Signature</p>
                    {teacherSignature && (
                      <img src={teacherSignature} alt="Teacher signature" className="max-h-16 border border-slate-200 rounded-lg bg-white p-1.5 mb-2" />
                    )}
                    <p className="text-sm text-slate-700"><span className="font-semibold">Signed By:</span> {effectiveName || `${profile?.first_name} ${profile?.last_name}`}</p>
                    <p className="text-sm text-slate-500"><span className="font-semibold">Signed At:</span> {teacherSignedAt ? new Date(teacherSignedAt).toLocaleString() : '—'}</p>
                  </div>
                </div>

                <div className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-colors ${confirmed ? 'bg-violet-50 border-violet-300' : 'bg-slate-50 border-slate-200'}`}>
                  <Checkbox id="confirm" checked={confirmed} onCheckedChange={v => setConfirmed(v)} className="mt-0.5" />
                  <label htmlFor="confirm" className="text-sm text-slate-700 cursor-pointer leading-relaxed">
                    I confirm this achievement record is accurate and should be submitted to the school administrator for approval. No NFT will be minted until approved.
                  </label>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6 mt-6 border-t border-slate-100">
              <Button variant="outline" onClick={handleBack} disabled={currentStep === 1} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>

              {currentStep < 5 ? (
                currentStep !== 4 ? (
                  <Button onClick={handleNext} disabled={!canGoNext} className="gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40">
                    Next <Award className="h-4 w-4" />
                  </Button>
                ) : (
                  teacherSignature && (
                    <Button onClick={handleNext} className="gap-2 bg-violet-600 hover:bg-violet-700">
                      Next <Award className="h-4 w-4" />
                    </Button>
                  )
                )
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!confirmed || !teacherSignature || !evidenceUrl || submitting}
                  className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg disabled:opacity-40"
                >
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : <><SendHorizonal className="h-4 w-4" /> Submit For Approval</>}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview panel */}
        <div className="space-y-4">
          {blockWardPreview && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">Preview</p>
              <BlockWardPreviewCard blockWard={blockWardPreview} />
            </div>
          )}
          {selectedStudent && (
            <Card className="border border-violet-200 bg-violet-50">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-2">Selected Student</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                    {selectedStudent.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{selectedStudent.name}</p>
                    <p className="text-xs text-slate-500">{selectedStudent.className}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {currentStep >= 3 && evidenceUrl && (
            <Card className="border border-green-200 bg-green-50">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">Evidence Uploaded</p>
                <p className="text-sm text-slate-600">Required evidence attached ✓</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IssueBlockWard() {
  return (
    <RoleGuard roles={['teacher']}>
      <IssueBlockWardContent />
    </RoleGuard>
  );
}