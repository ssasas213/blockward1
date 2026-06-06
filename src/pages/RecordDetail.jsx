import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ArrowLeft, PenLine, Check, X, HardDrive, ExternalLink, Loader2, FileText, Shield, User, SendHorizonal, RefreshCw } from 'lucide-react';
import RecordStatusBadge from '@/components/records/RecordStatusBadge';
import SignatureCapture from '@/components/records/SignatureCapture';
import AuditTrail from '@/components/records/AuditTrail';

export default function RecordDetail() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const recordId = params.get('id');

  const [record, setRecord] = useState(null);
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [adminSig, setAdminSig] = useState(null);
  const [studentSig, setStudentSig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [savingToDrive, setSavingToDrive] = useState(false);
  const [signing, setSigning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => { loadAll(); }, [recordId]);

  const loadAll = async () => {
    if (!recordId) return;
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      const p = profiles[0];
      setProfile(p);

      // Block inactive users
      if (p?.status === 'inactive' || p?.status === 'suspended') {
        toast.error('Your account is inactive. Contact your administrator.');
        navigate(-1);
        return;
      }

      const records = await base44.entities.StudentRecord.filter({ id: recordId });
      if (!records.length) { toast.error('Record not found'); return; }
      const rec = records[0];

      // School isolation
      if (p?.school_id && rec.school_id && p.school_id !== rec.school_id) {
        toast.error('Access denied'); navigate(-1); return;
      }
      // Students can only see their own records
      if (p?.user_type === 'student' && rec.student_email !== currentUser.email) {
        toast.error('Access denied'); navigate(-1); return;
      }

      setRecord(rec);

      const [logs, sigs] = await Promise.all([
        base44.entities.AuditLog.filter({ record_id: recordId }),
        base44.entities.DigitalSignature.filter({ record_id: recordId })
      ]);
      setAuditLogs(logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
      setAdminSig(sigs.find(s => s.signer_role === 'admin') || null);
      setStudentSig(sigs.find(s => s.signer_role === 'student') || null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // All transitions go through backend recordWorkflow
  const callWorkflow = async (action, extra = {}) => {
    const res = await base44.functions.invoke('recordWorkflow', { action, recordId, ...extra });
    if (!res.data?.ok) throw new Error(res.data?.error || 'Action failed');
    return res.data;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await callWorkflow('submitRecord');
      toast.success('Submitted for admin signature');
      loadAll();
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const handleSign = async (sigData) => {
    setSigning(true);
    try {
      const isAdmin = profile.user_type === 'admin';
      const action = isAdmin ? 'adminSignRecord' : 'studentSignRecord';
      await callWorkflow(action, { signatureData: sigData });
      setShowSignDialog(false);
      toast.success('Signature saved successfully');
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
      await callWorkflow('adminRejectRecord', { rejectionReason: rejectReason });
      setShowRejectDialog(false);
      setRejectReason('');
      toast.success('Record rejected');
      loadAll();
    } catch (e) { toast.error(e.message); }
    finally { setRejecting(false); }
  };

  const handleSaveToDrive = async () => {
    setSavingToDrive(true);
    try {
      const res = await base44.functions.invoke('saveRecordToDrive', { recordId });
      if (res.data?.ok) {
        toast.success('Saved to Google Drive successfully!');
        loadAll();
      } else {
        // Never silently succeed — show the real error
        toast.error(res.data?.error || 'Failed to save to Drive');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingToDrive(false);
    }
  };

  // Derived permissions
  const canSubmit = record?.status === 'draft'
    && profile?.user_type === 'teacher'
    && record?.teacher_email === user?.email
    && profile?.status !== 'inactive' && profile?.status !== 'suspended';

  const canSign = () => {
    if (!record || !profile) return false;
    if (profile.status === 'inactive' || profile.status === 'suspended') return false;
    if (profile.user_type === 'admin') {
      return record.status === 'awaiting_admin_signature' && !record.admin_signed;
    }
    if (profile.user_type === 'student') {
      return record.status === 'awaiting_student_signature' && !record.student_signed && record.student_email === user?.email;
    }
    return false;
  };

  const canReject = record?.status === 'awaiting_admin_signature'
    && profile?.user_type === 'admin'
    && profile?.status !== 'inactive';

  // HIGH PRIORITY FIX: only admin can trigger Drive save
  const canSaveToDrive = record?.status === 'pending_drive_save'
    && record?.admin_signed
    && record?.student_signed
    && profile?.user_type === 'admin';

  const CATEGORY_COLORS = {
    academic: 'bg-blue-100 text-blue-700',
    sports: 'bg-green-100 text-green-700',
    arts: 'bg-pink-100 text-pink-700',
    leadership: 'bg-purple-100 text-purple-700',
    community: 'bg-amber-100 text-amber-700',
    behaviour: 'bg-red-100 text-red-700',
    special: 'bg-indigo-100 text-indigo-700',
  };

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
            <Badge className={`${CATEGORY_COLORS[record.category] || 'bg-slate-100'} border-0 capitalize`}>
              {record.category}
            </Badge>
          </div>
          <p className="text-slate-500 mt-1 text-sm">Created {format(new Date(record.created_date), 'MMM d, yyyy')}</p>
        </div>
      </div>

      {/* Rejection reason banner */}
      {record.status === 'rejected' && record.rejection_reason && (
        <div className="rounded-xl p-4 bg-red-50 border border-red-200">
          <p className="text-sm font-semibold text-red-700 mb-1">Rejection Reason</p>
          <p className="text-sm text-red-600">{record.rejection_reason}</p>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap gap-3">
        {canSubmit && (
          <Button onClick={handleSubmit} disabled={submitting} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <SendHorizonal className="h-4 w-4 mr-2" />}
            Submit for Admin Review
          </Button>
        )}
        {canSign() && (
          <Button onClick={() => setShowSignDialog(true)} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
            <PenLine className="h-4 w-4 mr-2" /> Sign This Record
          </Button>
        )}
        {canReject && (
          <Button variant="outline" onClick={() => setShowRejectDialog(true)} className="border-red-200 text-red-600 hover:bg-red-50">
            <X className="h-4 w-4 mr-2" /> Reject
          </Button>
        )}
        {canSaveToDrive && (
          <Button onClick={handleSaveToDrive} disabled={savingToDrive} className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700">
            {savingToDrive ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <HardDrive className="h-4 w-4 mr-2" />}
            Save to Google Drive
          </Button>
        )}
        {/* Retry button for failed drive saves */}
        {record.status === 'pending_drive_save' && profile?.user_type === 'admin' && !savingToDrive && record.admin_signed && record.student_signed && (
          <p className="text-xs text-slate-500 self-center">Ready to save to Google Drive</p>
        )}
        {record.drive_file_url && (
          <Button variant="outline" asChild>
            <a href={record.drive_file_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" /> View on Google Drive
            </a>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">

          {/* Record Details */}
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Record Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Student</p>
                  <p className="font-medium">{record.student_name}</p>
                  <p className="text-xs text-slate-400">{record.student_email}</p>
                </div>
                <div>
                  <p className="text-slate-500">Teacher</p>
                  <p className="font-medium">{record.teacher_name}</p>
                  <p className="text-xs text-slate-400">{record.teacher_email}</p>
                </div>
                {record.class_name && (
                  <div>
                    <p className="text-slate-500">Class</p>
                    <p className="font-medium">{record.class_name}</p>
                  </div>
                )}
                {record.admin_name && (
                  <div>
                    <p className="text-slate-500">Admin</p>
                    <p className="font-medium">{record.admin_name}</p>
                  </div>
                )}
                {record.submitted_at && (
                  <div>
                    <p className="text-slate-500">Submitted At</p>
                    <p className="font-medium">{format(new Date(record.submitted_at), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                )}
                {record.approved_at && (
                  <div>
                    <p className="text-slate-500">Approved At</p>
                    <p className="font-medium">{format(new Date(record.approved_at), 'MMM d, yyyy HH:mm')}</p>
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
                  <p className="text-sm text-slate-500 mb-2">Attached Evidence</p>
                  {record.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <img src={record.file_url} alt="Record attachment" className="max-h-48 rounded-lg border" />
                  ) : (
                    <Button variant="outline" size="sm" asChild>
                      <a href={record.file_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" /> View Attached File
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signatures — read-only display, no editing allowed */}
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><PenLine className="h-4 w-4" /> Digital Signatures</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Admin Signature */}
              <div className={`rounded-xl p-4 border-2 ${record.admin_signed ? 'border-violet-200 bg-violet-50' : 'border-dashed border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-violet-600" />
                    <span className="font-medium text-sm">Admin Signature</span>
                    {record.admin_signed && <span className="text-xs text-slate-400 ml-1">(immutable)</span>}
                  </div>
                  {record.admin_signed
                    ? <Badge className="bg-violet-100 text-violet-700 border-0 gap-1"><Check className="h-3 w-3" /> Signed</Badge>
                    : <Badge className="bg-slate-100 text-slate-500 border-0">Pending</Badge>}
                </div>
                {adminSig && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-700">{adminSig.signer_name}</p>
                    {adminSig.signature_type === 'drawn' ? (
                      <img src={adminSig.signature_value} alt="Admin signature" className="h-12 border rounded bg-white" />
                    ) : (
                      <p className="text-lg italic text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>{adminSig.signature_value}</p>
                    )}
                    <p className="text-xs text-slate-400">{format(new Date(adminSig.signed_at), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                )}
              </div>

              {/* Student Signature */}
              <div className={`rounded-xl p-4 border-2 ${record.student_signed ? 'border-emerald-200 bg-emerald-50' : 'border-dashed border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium text-sm">Student Signature</span>
                    {record.student_signed && <span className="text-xs text-slate-400 ml-1">(immutable)</span>}
                  </div>
                  {record.student_signed
                    ? <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1"><Check className="h-3 w-3" /> Signed</Badge>
                    : <Badge className="bg-slate-100 text-slate-500 border-0">Pending</Badge>}
                </div>
                {studentSig && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-700">{studentSig.signer_name}</p>
                    {studentSig.signature_type === 'drawn' ? (
                      <img src={studentSig.signature_value} alt="Student signature" className="h-12 border rounded bg-white" />
                    ) : (
                      <p className="text-lg italic text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>{studentSig.signature_value}</p>
                    )}
                    <p className="text-xs text-slate-400">{format(new Date(studentSig.signed_at), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                )}
              </div>

              {/* Drive save info */}
              {record.drive_folder_path && (
                <div className="rounded-xl p-4 border border-purple-200 bg-purple-50">
                  <div className="flex items-center gap-2 mb-1">
                    <HardDrive className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-sm text-purple-800">Saved to Google Drive</span>
                  </div>
                  <p className="text-xs text-purple-600">{record.drive_folder_path}</p>
                  {record.drive_file_id && <p className="text-xs text-purple-400 mt-1">File ID: {record.drive_file_id}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Status timeline + Audit */}
        <div className="space-y-6">
          {/* Status Flow */}
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base">Status Flow</CardTitle></CardHeader>
            <CardContent>
              {[
                { key: 'draft', label: 'Draft' },
                { key: 'awaiting_admin_signature', label: 'Admin Review' },
                { key: 'awaiting_student_signature', label: 'Student Signs' },
                { key: 'pending_drive_save', label: 'Save to Drive' },
                { key: 'active', label: 'Active Record' },
              ].map((step, i, arr) => {
                const ORDER = ['draft', 'submitted', 'awaiting_admin_signature', 'awaiting_student_signature', 'pending_drive_save', 'active'];
                const current = ORDER.indexOf(record.status);
                const stepIdx = ORDER.indexOf(step.key);
                const done = current > stepIdx;
                const active = current === stepIdx;
                const isRejected = record.status === 'rejected';
                return (
                  <div key={step.key} className="flex items-start gap-3 mb-3">
                    <div className="flex flex-col items-center">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isRejected && step.key === 'awaiting_admin_signature' ? 'bg-red-500 text-white' :
                        done ? 'bg-violet-600 text-white' :
                        active ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-500' :
                        'bg-slate-100 text-slate-400'
                      }`}>
                        {done ? <Check className="h-3 w-3" /> : isRejected && step.key === 'awaiting_admin_signature' ? <X className="h-3 w-3" /> : i + 1}
                      </div>
                      {i < arr.length - 1 && <div className={`w-0.5 h-5 mt-0.5 ${done ? 'bg-violet-400' : 'bg-slate-200'}`} />}
                    </div>
                    <p className={`text-sm pt-0.5 ${active ? 'font-semibold text-violet-700' : done ? 'text-slate-600' : 'text-slate-400'}`}>{step.label}</p>
                  </div>
                );
              })}
              {record.status === 'rejected' && (
                <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-xs font-semibold text-red-600">Record Rejected</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Trail */}
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
            <CardContent>
              <AuditTrail logs={auditLogs} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sign Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sign This Record</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-slate-600 mb-4">
              By signing, you confirm you have reviewed this record: <strong>{record.title}</strong>
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3 mb-4">
              ⚠️ Signatures are permanent and cannot be edited or deleted after submission.
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
            <DialogTitle>Reject Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-600">Provide a reason for rejection. The teacher will be notified.</p>
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