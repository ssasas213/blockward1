import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, CheckCircle2, Award, AlertTriangle, Shield, Check } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import StudentPicker from '@/components/blockwards/StudentPicker';
import BlockWardPreviewCard from '@/components/blockwards/BlockWardPreviewCard';
import SignatureStep from '@/components/blockwards/SignatureStep';

// ─── Stepper ──────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, name: 'Select Student' },
  { id: 2, name: 'Choose Award' },
  { id: 3, name: 'Teacher Signature' },
  { id: 4, name: 'Review & Issue' },
];

function Stepper({ currentStep }) {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center flex-1">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold transition-all
                ${currentStep > step.id ? 'bg-green-500 text-white' :
                  currentStep === step.id ? 'bg-violet-600 text-white ring-4 ring-violet-100' :
                  'bg-slate-200 text-slate-500'}`}>
                {currentStep > step.id ? <Check className="h-5 w-5" /> : step.id}
              </div>
              <p className={`text-xs mt-2 font-medium text-center ${currentStep >= step.id ? 'text-slate-900' : 'text-slate-400'}`}>
                {step.name}
              </p>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 mt-[-20px] transition-all ${currentStep > step.id ? 'bg-green-500' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Award Picker ─────────────────────────────────────────────────────────────
const CATEGORIES = ['academic', 'sports', 'arts', 'leadership', 'community', 'special'];

function AwardPicker({ awardTypes, selectedAward, onSelect }) {
  const [catFilter, setCatFilter] = useState('all');
  const filtered = catFilter === 'all' ? awardTypes : awardTypes.filter(a => a.category === catFilter || !a.category);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {['all', ...CATEGORIES].map(c => (
          <button key={c} type="button" onClick={() => setCatFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
              ${catFilter === c ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600 hover:border-violet-400'}`}>
            {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-8">No award types found</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
          {filtered.map(award => {
            const isSelected = selectedAward?.id === award.id;
            return (
              <button key={award.id} type="button" onClick={() => onSelect(award)}
                className={`p-4 rounded-xl border-2 text-left transition-all
                  ${isSelected ? 'border-violet-500 bg-violet-50 shadow-md' : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{award.title}</p>
                    {award.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{award.description}</p>}
                  </div>
                  {isSelected && <CheckCircle2 className="h-5 w-5 text-violet-500 flex-shrink-0" />}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {award.category && <Badge variant="outline" className="text-xs">{award.category}</Badge>}
                </div>
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
  const [schoolId, setSchoolId] = useState(null);
  const [schoolName, setSchoolName] = useState('');
  const [students, setStudents] = useState([]);
  const [awardTypes, setAwardTypes] = useState([]);
  const [issuing, setIssuing] = useState(false);
  const [issueSuccess, setIssueSuccess] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedAward, setSelectedAward] = useState(null);
  const [teacherSignature, setTeacherSignature] = useState(null);   // base64 PNG
  const [teacherSignedAt, setTeacherSignedAt] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

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

      if (sid) {
        const schools = await base44.entities.School.filter({ id: sid });
        if (schools[0]) setSchoolName(schools[0].name);

        const allProfiles = await base44.entities.UserProfile.filter({ school_id: sid, user_type: 'student' });
        setStudents(allProfiles.map(sp => ({
          id: sp.id,
          name: `${sp.first_name} ${sp.last_name}`,
          email: sp.user_email,
          class: sp.grade_level || 'Student',
          avatarUrl: sp.avatar_url || null,
        })));
      }

      const awards = await base44.entities.AwardTypes.filter({ is_active: true });
      setAwardTypes(awards);
    } catch (e) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !selectedStudent) { toast.error('Please select a student'); return; }
    if (currentStep === 2 && !selectedAward) { toast.error('Please select an award'); return; }
    if (currentStep === 3 && !teacherSignature) { toast.error('Please draw your signature before continuing'); return; }
    setCurrentStep(s => Math.min(s + 1, 4));
  };

  const handleBack = () => setCurrentStep(s => Math.max(s - 1, 1));

  const handleIssue = async () => {
    if (!confirmed) { toast.error('Please tick the confirmation checkbox'); return; }
    if (!teacherSignature) { toast.error('Teacher signature is required'); return; }
    setIssuing(true);
    try {
      // Upload base64 signature as a file
      let signatureUrl = teacherSignature;
      try {
        const blob = await (await fetch(teacherSignature)).blob();
        const sigFile = new File([blob], 'teacher-signature.png', { type: 'image/png' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file: sigFile });
        signatureUrl = file_url;
      } catch (_) { /* fall back to base64 if upload fails */ }

      await base44.functions.invoke('issueBlockward', {
        studentEmail: selectedStudent.email,
        awardTypeId: selectedAward.id,
        teacherEmail: user.email,
        teacherName: `${profile.first_name} ${profile.last_name}`,
        teacherSignatureUrl: signatureUrl,
        teacherSignedAt,
        schoolId,
      });

      setIssueSuccess(true);
      toast.success('BlockWard issued successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to issue BlockWard');
    } finally {
      setIssuing(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setSelectedStudent(null);
    setSelectedAward(null);
    setTeacherSignature(null);
    setTeacherSignedAt(null);
    setConfirmed(false);
    setIssueSuccess(false);
  };

  // ── Loading ──
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
    </div>
  );

  // ── Access guard ──
  if (profile && profile.user_type !== 'teacher') {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500">Only teachers can issue BlockWards.</p>
      </div>
    );
  }

  // ── Success ──
  if (issueSuccess) return (
    <div className="max-w-2xl mx-auto py-12">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="border-0 shadow-2xl">
          <CardContent className="p-12 text-center">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">BlockWard Issued!</h2>
            <p className="text-slate-500 mb-8">
              <strong className="text-slate-800">{selectedAward?.title}</strong> has been issued to{' '}
              <strong className="text-slate-800">{selectedStudent?.name}</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 gap-2" onClick={() => navigate(createPageUrl('TeacherBlockWards'))}>
                <Award className="h-4 w-4" /> View All BlockWards
              </Button>
              <Button variant="outline" onClick={resetForm}>Issue Another</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );

  const blockWardPreview = selectedAward ? {
    title: selectedAward.title,
    description: selectedAward.description || '',
    category: selectedAward.category || 'special',
    rarity: 'Common',
    icon: '🏆',
  } : null;

  // ── Nav button logic ──
  const canGoNext =
    (currentStep === 1 && !!selectedStudent) ||
    (currentStep === 2 && !!selectedAward) ||
    (currentStep === 3 && !!teacherSignature);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('TeacherBlockWards'))} className="hover:bg-slate-100 rounded-xl">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Issue a BlockWard</h1>
          <p className="text-slate-500 mt-0.5">Recognize student achievements</p>
        </div>
      </div>

      {/* Stepper */}
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
                  <p className="text-sm text-slate-500">Choose the student to receive this BlockWard.</p>
                </div>
                <StudentPicker students={students} selectedStudent={selectedStudent} onSelect={setSelectedStudent} />
              </div>
            )}

            {/* Step 2: Choose Award */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-1">Choose Award</h2>
                  <p className="text-sm text-slate-500">Select the achievement type for <strong className="text-slate-700">{selectedStudent?.name}</strong>.</p>
                </div>
                <AwardPicker awardTypes={awardTypes} selectedAward={selectedAward} onSelect={setSelectedAward} />
              </div>
            )}

            {/* Step 3: Teacher Signature */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-1">Teacher Signature</h2>
                  <p className="text-sm text-slate-500">Sign below to verify this BlockWard. Your signature will be permanently attached.</p>
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

            {/* Step 4: Review & Issue */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-1">Review & Issue</h2>
                  <p className="text-sm text-slate-500">Confirm the details before permanently issuing</p>
                </div>

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                  <div className="p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Awarding To</p>
                    <p className="font-bold text-slate-900 text-lg">{selectedStudent?.name}</p>
                    <p className="text-sm text-slate-500">{selectedStudent?.class}</p>
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Achievement</p>
                    <p className="font-bold text-slate-900 text-lg">{selectedAward?.title}</p>
                    {selectedAward?.description && <p className="text-sm text-slate-500">{selectedAward.description}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedAward?.category && <Badge variant="outline" className="text-xs capitalize">{selectedAward.category}</Badge>}
                    </div>
                  </div>
                  {/* Signature preview */}
                  <div className="p-5">
                    <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-2">Teacher Signature</p>
                    {teacherSignature && (
                      <img src={teacherSignature} alt="Teacher signature" className="max-h-16 border border-slate-200 rounded-lg bg-white p-1.5 mb-2" />
                    )}
                    <p className="text-sm text-slate-700"><span className="font-semibold">Signed By:</span> {profile?.first_name} {profile?.last_name}</p>
                    <p className="text-sm text-slate-500"><span className="font-semibold">Signed At:</span> {teacherSignedAt ? new Date(teacherSignedAt).toLocaleString() : '—'}</p>
                  </div>
                </div>

                {/* Confirm checkbox */}
                <div className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-colors ${confirmed ? 'bg-violet-50 border-violet-300' : 'bg-slate-50 border-slate-200'}`}>
                  <Checkbox id="confirm" checked={confirmed} onCheckedChange={v => setConfirmed(v)} className="mt-0.5" />
                  <label htmlFor="confirm" className="text-sm text-slate-700 cursor-pointer leading-relaxed">
                    I confirm this award is accurate and should be permanently issued to <strong>{selectedStudent?.name}</strong>
                  </label>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6 mt-6 border-t border-slate-100">
              <Button variant="outline" onClick={handleBack} disabled={currentStep === 1} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>

              {currentStep < 4 ? (
                // On step 3, hide Next until signature is drawn (SignatureStep handles its own confirm)
                currentStep !== 3 ? (
                  <Button onClick={handleNext} disabled={!canGoNext} className="gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40">
                    Next <Award className="h-4 w-4" />
                  </Button>
                ) : (
                  // After signature confirmed, show Next
                  teacherSignature && (
                    <Button onClick={handleNext} className="gap-2 bg-violet-600 hover:bg-violet-700">
                      Next <Award className="h-4 w-4" />
                    </Button>
                  )
                )
              ) : (
                <Button
                  onClick={handleIssue}
                  disabled={!confirmed || !teacherSignature || issuing}
                  className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg disabled:opacity-40"
                >
                  {issuing ? <><Loader2 className="h-4 w-4 animate-spin" /> Issuing...</> : <><Shield className="h-4 w-4" /> Issue BlockWard</>}
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
                    <p className="text-xs text-slate-500">{selectedStudent.class}</p>
                  </div>
                </div>
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
    <ProtectedRoute>
      <IssueBlockWardContent />
    </ProtectedRoute>
  );
}