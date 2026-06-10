import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ArrowLeft, PenLine, Check, X, HardDrive, ExternalLink, Loader2,
  Trophy, Shield, User, SendHorizonal, Sparkles, Copy, Link2
} from 'lucide-react';
import RecordStatusBadge from '@/components/records/RecordStatusBadge';
import SignatureCapture from '@/components/records/SignatureCapture';
import AuditTrail from '@/components/records/AuditTrail';
import SignatureSetup from '@/components/records/SignatureSetup';
import SignatureConfirmDialog from '@/components/records/SignatureConfirmDialog';

const CATEGORY_COLORS = {
  academic: 'from-blue-500 to-indigo-500',
  sports: 'from-green-500 to-emerald-500',
  arts: 'from-pink-500 to-rose-500',
  leadership: 'from-purple-500 to-violet-500',
  community: 'from-amber-500 to-orange-500',
  behaviour: 'from-red-500 to-rose-500',
  special: 'from-indigo-500 to-purple-500',
};

export default function RecordDetail() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const recordId = params.get('id');

  const [record, setRecord] = useState(null);
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [teacherSig, setTeacherSig] = useState(null);
  const [adminSig, setAdminSig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [minting, setMinting] = useState(false);
  const [signing, setSigning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [sigProfile, setSigProfile] = useState(null);
  const [showSigSetup, setShowSigSetup] = useState(false);

  useEffect(() => { loadAll(); }, [recordId]);

  const loadAll = async () => {
    if (!recordId) return;
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      const p = profiles[0];
      setProfile(p);

      if (p?.status === 'inactive' || p?.status === 'suspended') {
        toast.error('Your account is inactive.');
        navigate(-1);
        return;
      }

      const records = await base44.entities.StudentRecord.filter({ id: recordId });
      if (!records.length) { toast.error('Record not found'); return; }
      const rec = records[0];

      // Load signature profile for teacher/admin
      if (p?.user_type === 'teacher' || p?.user_type === 'admin') {
        const sigProfiles = await base44.entities.SignatureProfile.filter({ user_email: currentUser.email });
        setSigProfile(sigProfiles[0] || null);
      }

      if (p?.school_id && rec.school_id && p.school_id !== rec.school_id) {
        toast.error('Access denied'); navigate(-1); return;
      }
      if (p?.user_type === 'student' && rec.student_email !== currentUser.email) {
        toast.error('Access denied'); navigate(-1); return;
      }

      setRecord(rec);

      const [logs, sigs] = await Promise.all([
        base44.entities.AuditLog.filter({ record_id: recordId }),
        base44.entities.DigitalSignature.filter({ record_id: recordId })
      ]);
      setAuditLogs(logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
      setTeacherSig(sigs.find(s => s.signer_role === 'teacher') || null);
      setAdminSig(sigs.find(s => s.signer_role === 'admin') || null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const callWorkflow = async (action, extra = {}) => {
    const res = await base44.functions.invoke('recordWorkflow', { action, recordId, ...extra });
    if (!res.data?.ok) throw new Error(res.data?.error || 'Action failed');
    return res.data;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await callWorkflow('submitRecord');
      toast.success('Achievement submitted for teacher review!');
      loadAll();
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const handleSign = async (sigData) => {
    setSigning(true);
    try {
      const action = profile.user_type === 'admin' ? 'adminSignRecord' : 'teacherSignRecord';
      await callWorkflow(action, { signatureData: sigData });
      setShowSignDialog(false);
      toast.success(profile.user_type === 'admin' ? 'Approved! Achievement is now ready to mint.' : 'Signed! Forwarded to admin for final approval.');
      loadAll();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSigning(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('Please provide a rejection reason'); return; }
    setRejecting(true);
    try {
      const action = profile.user_type === 'teacher' ? 'teacherRejectRecord' : 'adminRejectRecord';
      await callWorkflow(action, { rejectionReason: rejectReason });
      setShowRejectDialog(false);
      setRejectReason('');
      toast.success('Record rejected');
      loadAll();
    } catch (e) { toast.error(e.message); }
    finally { setRejecting(false); }
  };

  const handleMintAndArchive = async () => {
    setMinting(true);
    try {
      // Try per-student Drive first; fall back to shared Drive
      const res = await base44.functions.invoke('saveToStudentDrive', { recordId });
      if (res.data?.ok) {
        toast.success('NFT archived to student\'s Google Drive!');
        loadAll();
      } else if (res.data?.needs_student_drive) {
        // Student hasn't connected Drive — fall back to shared Drive archive
        toast.info('Student Drive not connected — archiving to school Drive instead...');
        const fallback = await base44.functions.invoke('mintAndArchive', { recordId });
        if (fallback.data?.ok) {
          toast.success('NFT minted and archived to school Google Drive!');
          loadAll();
        } else {
          toast.error(fallback.data?.error || 'Minting failed');
        }
      } else {
        toast.error(res.data?.error || 'Minting failed');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setMinting(false);
    }
  };

  const copyVerifyLink = () => {
    const link = `${window.location.origin}/Verify?id=${record.verify_id}`;
    navigator.clipboard.writeText(link);
    toast.success('Verification link copied!');
  };

  // Permissions
  const canSubmit = record?.status === 'draft'
    && profile?.user_type === 'student'
    && record?.student_email === user?.email;

  const canTeacherSign = record?.status === 'awaiting_teacher_signature'
    && profile?.user_type === 'teacher';

  const canAdminSign = record?.status === 'awaiting_admin_signature'
    && profile?.user_type === 'admin';

  const canReject = (canTeacherSign || canAdminSign);

  const canMint = record?.status === 'approved'
    && profile?.user_type === 'admin';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
    </div>
  );

  if (!record) return <div className="p-8 text-center text-slate-500">Record not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{record.title}</h1>
            <RecordStatusBadge status={record.status} />
            <Badge className="bg-slate-100 text-slate-600 border-0 capitalize">{record.category}</Badge>
          </div>
          <p className="text-slate-500 mt-1 text-sm">Submitted {format(new Date(record.created_date), 'MMM d, yyyy')}</p>
        </div>
      </div>

      {/* Rejection banner */}
      {record.status === 'rejected' && (record.rejection_reason || record.teacher_rejection_reason) && (
        <div className="rounded-xl p-4 bg-red-50 border border-red-200">
          <p className="text-sm font-semibold text-red-700 mb-1">Rejection Reason</p>
          <p className="text-sm text-red-600">{record.rejection_reason || record.teacher_rejection_reason}</p>
        </div>
      )}

      {/* NFT Card — show when minted */}
      {(record.status === 'minted' || record.status === 'archived') && (
        <div className={`rounded-2xl bg-gradient-to-br ${CATEGORY_COLORS[record.category] || 'from-violet-500 to-indigo-500'} p-1`}>
          <div className="bg-white rounded-xl p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {record.nft_image_url ? (
                <img src={record.nft_image_url} alt="NFT" className="w-40 h-40 rounded-xl object-cover shadow-lg flex-shrink-0" />
              ) : (
                <div className={`w-40 h-40 rounded-xl bg-gradient-to-br ${CATEGORY_COLORS[record.category]} flex items-center justify-center flex-shrink-0`}>
                  <Trophy className="h-20 w-20 text-white/80" />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-5 w-5 text-violet-600" />
                  <span className="text-sm font-semibold text-violet-600 uppercase tracking-wide">Verified NFT Achievement</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">{record.title}</h2>
                <p className="text-slate-600 text-sm mb-3">{record.description}</p>
                <div className="flex flex-wrap gap-2">
                  {record.verify_id && (
                    <Button size="sm" variant="outline" onClick={copyVerifyLink} className="gap-1">
                      <Link2 className="h-3.5 w-3.5" /> Copy Verify Link
                    </Button>
                  )}
                  {record.drive_file_url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={record.drive_file_url} target="_blank" rel="noopener noreferrer">
                        <HardDrive className="h-3.5 w-3.5 mr-1" /> View in Drive
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap gap-3">
        {canSubmit && (
          <Button onClick={handleSubmit} disabled={submitting} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <SendHorizonal className="h-4 w-4 mr-2" />}
            Submit for Teacher Review
          </Button>
        )}
        {(canTeacherSign || canAdminSign) && (
          <Button
            onClick={() => {
              if (!sigProfile) {
                setShowSigSetup(true);
              } else {
                setShowSignDialog(true);
              }
            }}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          >
            <PenLine className="h-4 w-4 mr-2" />
            {canAdminSign ? 'Sign & Approve' : 'Sign & Endorse'}
          </Button>
        )}
        {canReject && (
          <Button variant="outline" onClick={() => setShowRejectDialog(true)} className="border-red-200 text-red-600 hover:bg-red-50">
            <X className="h-4 w-4 mr-2" /> Reject
          </Button>
        )}
        {canMint && (
          <Button onClick={handleMintAndArchive} disabled={minting} className="bg-gradient-to-r from-emerald-600 to-violet-600 hover:from-emerald-700 hover:to-violet-700">
            {minting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {minting ? 'Minting NFT...' : 'Mint NFT & Archive to Drive'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">

          {/* Achievement Details */}
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4" /> Achievement Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Student</p>
                  <p className="font-medium">{record.student_name}</p>
                  <p className="text-xs text-slate-400">{record.student_email}</p>
                </div>
                {record.teacher_name && (
                  <div>
                    <p className="text-slate-500">Reviewing Teacher</p>
                    <p className="font-medium">{record.teacher_name}</p>
                  </div>
                )}
                {record.admin_name && (
                  <div>
                    <p className="text-slate-500">Approving Admin</p>
                    <p className="font-medium">{record.admin_name}</p>
                  </div>
                )}
                {record.date_achieved && (
                  <div>
                    <p className="text-slate-500">Date Achieved</p>
                    <p className="font-medium">{format(new Date(record.date_achieved), 'MMM d, yyyy')}</p>
                  </div>
                )}
                {record.class_name && (
                  <div>
                    <p className="text-slate-500">Class</p>
                    <p className="font-medium">{record.class_name}</p>
                  </div>
                )}
              </div>
              {record.description && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Description</p>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{record.description}</p>
                </div>
              )}
              {record.file_url && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Evidence</p>
                  {record.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <img src={record.file_url} alt="Evidence" className="max-h-64 rounded-xl border shadow-sm" />
                  ) : (
                    <Button variant="outline" size="sm" asChild>
                      <a href={record.file_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" /> View Evidence File
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signatures */}
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><PenLine className="h-4 w-4" /> Digital Signatures</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Teacher Signature */}
              <div className={`rounded-xl p-4 border-2 ${record.teacher_signed ? 'border-amber-200 bg-amber-50' : 'border-dashed border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-amber-600" />
                    <span className="font-medium text-sm">Teacher Endorsement</span>
                  </div>
                  {record.teacher_signed
                    ? <Badge className="bg-amber-100 text-amber-700 border-0 gap-1"><Check className="h-3 w-3" /> Signed</Badge>
                    : <Badge className="bg-slate-100 text-slate-500 border-0">Pending</Badge>}
                </div>
                {teacherSig && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-700">{teacherSig.signer_name}</p>
                    {teacherSig.signature_type === 'drawn'
                      ? <img src={teacherSig.signature_value} alt="Teacher sig" className="h-12 border rounded bg-white" />
                      : <p className="text-lg italic text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>{teacherSig.signature_value}</p>
                    }
                    <p className="text-xs text-slate-400">{format(new Date(teacherSig.signed_at), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                )}
              </div>

              {/* Admin Signature */}
              <div className={`rounded-xl p-4 border-2 ${record.admin_signed ? 'border-violet-200 bg-violet-50' : 'border-dashed border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-violet-600" />
                    <span className="font-medium text-sm">Admin Approval</span>
                  </div>
                  {record.admin_signed
                    ? <Badge className="bg-violet-100 text-violet-700 border-0 gap-1"><Check className="h-3 w-3" /> Signed</Badge>
                    : <Badge className="bg-slate-100 text-slate-500 border-0">Pending</Badge>}
                </div>
                {adminSig && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-700">{adminSig.signer_name}</p>
                    {adminSig.signature_type === 'drawn'
                      ? <img src={adminSig.signature_value} alt="Admin sig" className="h-12 border rounded bg-white" />
                      : <p className="text-lg italic text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>{adminSig.signature_value}</p>
                    }
                    <p className="text-xs text-slate-400">{format(new Date(adminSig.signed_at), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                )}
              </div>

              {/* Drive/NFT info */}
              {record.drive_folder_path && (
                <div className="rounded-xl p-4 border border-emerald-200 bg-emerald-50">
                  <div className="flex items-center gap-2 mb-1">
                    <HardDrive className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium text-sm text-emerald-800">Archived to Google Drive</span>
                  </div>
                  <p className="text-xs text-emerald-600">{record.drive_folder_path}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Flow */}
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base">Approval Flow</CardTitle></CardHeader>
            <CardContent>
              {[
                { key: 'draft', label: 'Student Submits' },
                { key: 'awaiting_teacher_signature', label: 'Teacher Reviews' },
                { key: 'awaiting_admin_signature', label: 'Admin Approves' },
                { key: 'approved', label: 'NFT Minting' },
                { key: 'minted', label: 'Archived to Drive' },
              ].map((step, i, arr) => {
                const ORDER = ['draft', 'awaiting_teacher_signature', 'awaiting_admin_signature', 'approved', 'minted', 'archived'];
                const current = ORDER.indexOf(record.status === 'archived' ? 'archived' : record.status);
                const stepIdx = ORDER.indexOf(step.key);
                const done = current > stepIdx;
                const active = current === stepIdx;
                const isRejected = record.status === 'rejected';
                return (
                  <div key={step.key} className="flex items-start gap-3 mb-3">
                    <div className="flex flex-col items-center">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isRejected && active ? 'bg-red-500 text-white' :
                        done ? 'bg-violet-600 text-white' :
                        active ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-500' :
                        'bg-slate-100 text-slate-400'
                      }`}>
                        {done ? <Check className="h-3 w-3" /> : i + 1}
                      </div>
                      {i < arr.length - 1 && <div className={`w-0.5 h-5 mt-0.5 ${done ? 'bg-violet-400' : 'bg-slate-200'}`} />}
                    </div>
                    <p className={`text-sm pt-0.5 ${active ? 'font-semibold text-violet-700' : done ? 'text-slate-600' : 'text-slate-400'}`}>{step.label}</p>
                  </div>
                );
              })}
              {record.status === 'rejected' && (
                <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-xs font-semibold text-red-600">Submission Rejected</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Verify Link */}
          {record.verify_id && (
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                  <Link2 className="h-4 w-4" /> Public Verification
                </p>
                <p className="text-xs text-slate-500 mb-3">Anyone can verify this achievement using this link — ideal for universities and employers.</p>
                <Button size="sm" variant="outline" onClick={copyVerifyLink} className="w-full gap-1">
                  <Copy className="h-3.5 w-3.5" /> Copy Verify Link
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Audit Trail */}
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
            <CardContent>
              <AuditTrail logs={auditLogs} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Signature Profile Setup (first-time) */}
      {showSigSetup && (
        <SignatureSetup
          profile={profile}
          userEmail={user?.email}
          onComplete={(newSigProfile) => {
            setSigProfile(newSigProfile);
            setShowSigSetup(false);
            setShowSignDialog(true);
          }}
        />
      )}

      {/* Sign Confirm Dialog (reuses saved signature profile) */}
      <SignatureConfirmDialog
        open={showSignDialog}
        onOpenChange={setShowSignDialog}
        sigProfile={sigProfile}
        record={record}
        userType={profile?.user_type}
        onConfirm={handleSign}
        disabled={signing}
      />

      {/* Fallback: if somehow sign dialog is opened without a sigProfile, show SignatureCapture */}
      <Dialog open={showSignDialog && !sigProfile} onOpenChange={setShowSignDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{profile?.user_type === 'admin' ? 'Sign & Approve Achievement' : 'Sign & Endorse Achievement'}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3 mb-4">
              ⚠️ Signatures are permanent and cannot be edited or deleted.
            </p>
            <SignatureCapture
              signerName={`${profile?.first_name} ${profile?.last_name}`}
              onConfirm={handleSign}
              disabled={signing}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Achievement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-600">Provide a reason for rejection. The student will be notified.</p>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Reason for rejection..." />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
              {rejecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}