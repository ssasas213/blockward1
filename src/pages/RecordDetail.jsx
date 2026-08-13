import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  ArrowLeft, PenLine, Check, X, ExternalLink, Loader2,
  Trophy, Shield, User, SendHorizonal, Copy, Link2, AlertCircle, CheckCircle2, ShieldCheck,
  MessageSquare, RefreshCw
} from 'lucide-react';
import StatusBadge from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/loading-skeleton';
import SignatureCapture from '@/components/records/SignatureCapture';
import AuditTrail from '@/components/records/AuditTrail';
import WorkflowTimeline from '@/components/records/WorkflowTimeline';
import WorkflowStepper from '@/components/records/WorkflowStepper';
import NextActionBadge from '@/components/records/NextActionBadge';
import EditResubmitDialog from '@/components/records/EditResubmitDialog';
import SignatureSetup from '@/components/records/SignatureSetup';
import SignatureConfirmDialog from '@/components/records/SignatureConfirmDialog';

const CATEGORY_COLORS = {
  academic: 'bg-blue-500/10 text-blue-400',
  sports: 'bg-green-500/10 text-green-400',
  arts: 'bg-purple-500/10 text-purple-400',
  leadership: 'bg-amber-500/10 text-amber-400',
  community: 'bg-rose-500/10 text-rose-400',
  behaviour: 'bg-red-500/10 text-red-400',
  special: 'bg-indigo-500/10 text-indigo-400',
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
  const [signing, setSigning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [sigProfile, setSigProfile] = useState(null);
  const [showSigSetup, setShowSigSetup] = useState(false);
  const [sendingVault, setSendingVault] = useState(false);
  const [showChangesDialog, setShowChangesDialog] = useState(false);
  const [changesReason, setChangesReason] = useState('');
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [showEditResubmit, setShowEditResubmit] = useState(false);
  const [errorType, setErrorType] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => { loadAll(); }, [recordId]);

  const loadAll = async () => {
    if (!recordId) { setLoading(false); return; }
    try {
      const res = await base44.functions.invoke('getRecordDetail', { recordId });
      const data = res.data;
      if (!data?.ok) {
        setErrorType(data?.error || 'unknown');
        setErrorMessage(data?.message || 'Record not found');
        setLoading(false);
        return;
      }
      setUser(data.user);
      setProfile(data.profile);
      setRecord(data.record);
      setAuditLogs(data.auditLogs || []);
      setTeacherSig(data.teacherSig || null);
      setAdminSig(data.adminSig || null);
      setSigProfile(data.sigProfile || null);
    } catch (e) {
      setErrorType('fetch_error');
      setErrorMessage(e.message);
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
      toast.success(profile.user_type === 'admin' ? 'Approved! Ready for vault delivery.' : 'Signed! Forwarded to admin for final approval.');
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

  const handleSendToVault = async () => {
    setSendingVault(true);
    try {
      const res = await base44.functions.invoke('sendToStudentVault', { record_id: recordId });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Delivery failed');
      const verifyUrl = res.data.publicVerificationUrl 
        ? `${window.location.origin}/verify/${res.data.verificationId}`
        : null;
      toast.success('Achievement delivered to student vault!', {
        description: verifyUrl ? `Verification ID: ${res.data.verificationId}` : undefined,
        action: verifyUrl ? {
          label: 'Copy Link',
          onClick: () => {
            navigator.clipboard.writeText(verifyUrl);
            toast.success('Verification link copied!');
          }
        } : undefined,
      });
      loadAll();
    } catch (e) { 
      toast.error('Delivery failed', { description: e.message });
    }
    finally { setSendingVault(false); }
  };

  const handleRequestChanges = async () => {
    if (!changesReason.trim()) { toast.error('Please provide feedback for the requested changes'); return; }
    setRequestingChanges(true);
    try {
      await callWorkflow('requestChanges', { rejectionReason: changesReason });
      setShowChangesDialog(false);
      setChangesReason('');
      toast.success('Changes requested — teacher and student notified');
      loadAll();
    } catch (e) { toast.error(e.message); }
    finally { setRequestingChanges(false); }
  };

  const copyVerifyLink = () => {
    const link = `${window.location.origin}/verify/${record.verify_id}`;
    navigator.clipboard.writeText(link);
    toast.success('Verification link copied!');
  };

  const canSubmit = record?.status === 'draft' && profile?.user_type === 'student' && record?.student_email === user?.email;
  const canTeacherSign = record?.status === 'awaiting_teacher_signature' && profile?.user_type === 'teacher';
  const canAdminSign = record?.status === 'awaiting_admin_signature' && profile?.user_type === 'admin';
  const canReject = (canTeacherSign || canAdminSign);
  const canSendToVault = record?.status === 'approved' && profile?.user_type === 'admin';
  const canRequestChanges = record?.status === 'awaiting_admin_signature' && profile?.user_type === 'admin';
  const canEditResubmit = record?.status === 'changes_requested' && (
    (profile?.user_type === 'student' && record?.student_email === user?.email) ||
    (profile?.user_type === 'teacher' && record?.teacher_email === user?.email)
  );

  const vaultBlockReason = (() => {
    if (!record?.teacher_signed) return 'Cannot send to vault: teacher signature missing.';
    if (!record?.admin_signed) return 'Cannot send to vault: admin signature missing.';
    if (!record?.file_url) return 'Cannot send to vault: evidence missing.';
    return null;
  })();

  if (loading) return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );

  if (!record) return (
    <div className="max-w-md mx-auto mt-20">
      <Card className="shadow-sm text-center">
        <CardContent className="py-12">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
            {errorType === 'not_found' ? <Trophy className="h-6 w-6 text-muted-foreground" /> : <AlertCircle className="h-6 w-6 text-muted-foreground" />}
          </div>
          <h1 className="text-lg font-semibold text-foreground mb-2">
            {errorType === 'not_found' ? 'Achievement Not Found' :
             errorType === 'access_denied' ? 'Permission Denied' :
             errorType === 'wrong_school' ? 'Wrong Organisation' :
             errorType === 'auth_required' ? 'Sign In Required' :
             'Unable to Load Record'}
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            {errorMessage || (recordId
              ? 'This record may have been deleted, or you may not have permission to view it. If you believe this is an error, please contact your school administrator.'
              : 'No record ID provided. Please open this page from a valid link.')}
          </p>
          <div className="flex gap-2 justify-center">
            {errorType === 'auth_required' && (
              <Button onClick={() => base44.auth.redirectToLogin()}>
                <PenLine className="h-4 w-4 mr-2" /> Sign In
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{record.title}</h1>
            <StatusBadge status={record.status} />
            <NextActionBadge status={record.status} record={record} />
            <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${CATEGORY_COLORS[record.category] || 'bg-slate-50 text-slate-600'}`}>
              {record.category}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">Submitted {format(new Date(record.created_date), 'MMM d, yyyy')}</p>
        </div>
      </div>

      {/* Status + lifecycle stepper */}
      <Card className="surface-card">
        <CardContent className="p-5">
          <WorkflowStepper record={record} />
        </CardContent>
      </Card>

      {/* Rejection banner */}
      {record.status === 'rejected' && (record.rejection_reason || record.teacher_rejection_reason) && (
        <div className="rounded-lg p-4 bg-destructive/5 border border-destructive/20">
          <p className="text-sm font-medium text-destructive mb-1">Rejection Reason</p>
          <p className="text-sm text-destructive">{record.rejection_reason || record.teacher_rejection_reason}</p>
        </div>
      )}

      {/* Changes Requested banner */}
      {record.status === 'changes_requested' && (
        <div className="rounded-lg p-4 bg-accent/5 border border-accent/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-accent">Changes Requested by Admin</p>
              {record.changes_requested_reason && (
                <p className="text-sm text-foreground mt-1">{record.changes_requested_reason}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {record.changes_requested_by_name ? `Requested by ${record.changes_requested_by_name}` : ''}
                {record.changes_requested_at ? ` · ${format(new Date(record.changes_requested_at), 'MMM d, yyyy HH:mm')}` : ''}
              </p>
              {canEditResubmit && (
                <p className="text-xs text-muted-foreground mt-1">Edit the achievement and resubmit to continue the approval.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delivery in progress banner (transient lock status) */}
      {record.status === 'delivering' && (
        <div className="rounded-lg p-4 bg-primary/5 border border-primary/20">
          <div className="flex items-start gap-3">
            <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-primary">Delivering BlockWard…</p>
              <p className="text-sm text-muted-foreground mt-1">
                {record.delivery_claimed_by && record.delivery_claimed_by !== user?.email
                  ? `Delivery is in progress by ${record.delivery_claimed_by}. Please wait and refresh.`
                  : 'Delivery is in progress. Please wait a moment and refresh.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Approved hero — ready for vault delivery */}
      {canSendToVault && (
        <div className="rounded-xl p-5 bg-success/5 border border-success/20">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="h-11 w-11 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-lg font-bold text-success tracking-tight">Approved</p>
                <p className="text-sm text-muted-foreground">Ready to be delivered to the student's BlockWard Vault.</p>
                {vaultBlockReason && (
                  <p className="text-sm text-destructive mt-1.5 font-medium">{vaultBlockReason}</p>
                )}
              </div>
            </div>
            <Button onClick={handleSendToVault} disabled={sendingVault || !!vaultBlockReason} size="lg" className="sm:min-w-[220px]">
              {sendingVault ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <SendHorizonal className="h-4 w-4 mr-2" />}
              {sendingVault ? 'Securing BlockWard…' : 'Send to Student Vault'}
            </Button>
          </div>
        </div>
      )}

      {/* Delivered banner — full success card for admins */}
      {record.status === 'delivered_to_vault' && (
        <Card className="shadow-sm border-success/20 bg-success/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-success flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> BlockWard Delivered
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  This achievement has been delivered to the student's BlockWard Vault.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm mb-4 pl-12">
              <div>
                <span className="text-muted-foreground">Student: </span>
                <span className="font-medium text-foreground">{record.student_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Achievement: </span>
                <span className="font-medium text-foreground">{record.title}</span>
              </div>
              {record.verify_id && (
                <div>
                  <span className="text-muted-foreground">Verification ID: </span>
                  <span className="font-mono text-xs text-foreground">{record.verify_id}</span>
                </div>
              )}
              {record.vault_delivered_at && (
                <div>
                  <span className="text-muted-foreground">Delivered: </span>
                  <span className="font-medium text-foreground">{format(new Date(record.vault_delivered_at), 'MMM d, yyyy HH:mm')}</span>
                </div>
              )}
            </div>
            {profile?.user_type === 'admin' && (
              <div className="flex flex-wrap gap-2 pl-12">
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/verify/${record.verify_id}`} target="_blank">
                    <Shield className="h-3.5 w-3.5 mr-1.5" /> View BlockWard
                  </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={copyVerifyLink}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Verification Link
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link to={createPageUrl('AdminApprovalQueue')}>
                    <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Return to Approvals
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* NFT Card */}
      {(record.status === 'delivered_to_vault' || record.status === 'archived') && (
        <Card className="shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row gap-4 p-5">
            {record.nft_image_url ? (
              <img src={record.nft_image_url} alt="NFT" className="w-32 h-32 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Trophy className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-primary uppercase tracking-wide">Verified NFT Achievement</span>
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">{record.title}</h2>
              <p className="text-sm text-muted-foreground mb-3">{record.description}</p>
              {record.verify_id && (
                <Button size="sm" variant="outline" onClick={copyVerifyLink}>
                  <Link2 className="h-3.5 w-3.5 mr-1.5" /> Copy Verify Link
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Action Bar — student & teacher actions (admin actions live in the right approval panel) */}
      <div className="flex flex-wrap gap-3">
        {canSubmit && (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <SendHorizonal className="h-4 w-4 mr-2" />}
            Submit for Teacher Review
          </Button>
        )}
        {canTeacherSign && (
          <Button
            onClick={() => {
              if (!sigProfile) setShowSigSetup(true);
              else setShowSignDialog(true);
            }}
          >
            <PenLine className="h-4 w-4 mr-2" />
            Sign &amp; Endorse
          </Button>
        )}
        {canTeacherSign && (
          <Button variant="destructive" onClick={() => setShowRejectDialog(true)}>
            <X className="h-4 w-4 mr-2" /> Reject
          </Button>
        )}
        {canEditResubmit && (
          <Button onClick={() => setShowEditResubmit(true)}>
            <RefreshCw className="h-4 w-4 mr-2" /> Edit &amp; Resubmit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4" /> Achievement Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Student</p>
                  <p className="font-medium text-foreground">{record.student_name}</p>
                  <p className="text-xs text-muted-foreground">{record.student_email}</p>
                </div>
                {record.teacher_name && (
                  <div>
                    <p className="text-muted-foreground">Teacher</p>
                    <p className="font-medium text-foreground">{record.teacher_name}</p>
                    <p className="text-xs text-muted-foreground">{record.teacher_email}</p>
                  </div>
                )}
                {record.admin_name && (
                  <div>
                    <p className="text-muted-foreground">Approving Admin</p>
                    <p className="font-medium text-foreground">{record.admin_name}</p>
                  </div>
                )}
                {record.date_achieved && (
                  <div>
                    <p className="text-muted-foreground">Date Achieved</p>
                    <p className="font-medium text-foreground">{format(new Date(record.date_achieved), 'MMM d, yyyy')}</p>
                  </div>
                )}
                {record.class_name && (
                  <div>
                    <p className="text-muted-foreground">Class</p>
                    <p className="font-medium text-foreground">{record.class_name}</p>
                  </div>
                )}
              </div>
              {record.is_custom_award && (
                <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-primary">Custom Award</p>
                    <p className="text-xs text-muted-foreground">Created by teacher for this record — not a school-wide template</p>
                  </div>
                </div>
              )}
              {!record.is_custom_award && record.award_type_title && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Award Template</p>
                  <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                    {record.award_type_title}
                    {record.title !== record.award_type_title && (
                      <Badge variant="outline" className="ml-auto text-xs">Customised</Badge>
                    )}
                  </p>
                </div>
              )}
              {record.points > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Points</p>
                  <p className="font-medium text-foreground">{record.points} pts</p>
                </div>
              )}
              {record.teacher_notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Teacher Notes for Admin</p>
                  <p className="text-sm text-foreground bg-warning/5 rounded-lg p-3 border border-warning/20">{record.teacher_notes}</p>
                </div>
              )}
              {record.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">{record.description}</p>
                </div>
              )}
              {record.certificate_url && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Certificate</p>
                  <Button variant="outline" size="sm" asChild>
                    <a href={record.certificate_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" /> View Certificate
                    </a>
                  </Button>
                </div>
              )}
              {record.file_url && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Evidence</p>
                  {record.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <img src={record.file_url} alt="Evidence" className="max-h-64 rounded-lg border border-border" />
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
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><PenLine className="h-4 w-4" /> Digital Signatures</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className={`rounded-lg p-4 border ${record.teacher_signed ? 'border-success/20 bg-success/5' : 'border-dashed border-border bg-muted/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-foreground">Teacher Endorsement</span>
                  </div>
                  {record.teacher_signed
                    ? <Badge className="bg-success/10 text-success border-0 gap-1"><Check className="h-3 w-3" /> Signed</Badge>
                    : <Badge variant="outline">Pending</Badge>}
                </div>
                {teacherSig && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{teacherSig.signer_name}</p>
                    {teacherSig.signature_type === 'drawn'
                      ? <img src={teacherSig.signature_value} alt="Teacher signature" className="h-12 border border-border rounded bg-card" />
                      : <p className="text-lg italic text-foreground" style={{ fontFamily: 'Georgia, serif' }}>{teacherSig.signature_value}</p>
                    }
                    <p className="text-xs text-muted-foreground">{format(new Date(teacherSig.signed_at), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                )}
              </div>

              <div className={`rounded-lg p-4 border ${record.admin_signed ? 'border-success/20 bg-success/5' : 'border-dashed border-border bg-muted/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-foreground">Admin Approval</span>
                  </div>
                  {record.admin_signed
                    ? <Badge className="bg-success/10 text-success border-0 gap-1"><Check className="h-3 w-3" /> Signed</Badge>
                    : <Badge variant="outline">Pending</Badge>}
                </div>
                {adminSig && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{adminSig.signer_name}</p>
                    {adminSig.signature_type === 'drawn'
                      ? <img src={adminSig.signature_value} alt="Admin signature" className="h-12 border border-border rounded bg-card" />
                      : <p className="text-lg italic text-foreground" style={{ fontFamily: 'Georgia, serif' }}>{adminSig.signature_value}</p>
                    }
                    <p className="text-xs text-muted-foreground">{format(new Date(adminSig.signed_at), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Admin Approval Panel */}
          {profile?.user_type === 'admin' && (canAdminSign || canRequestChanges || canSendToVault) && (
            <Card className="surface-card lg:sticky lg:top-20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Approval
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-tertiary">Student</span>
                    <span className="font-medium text-foreground truncate ml-2">{record.student_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-tertiary">Teacher</span>
                    <span className="font-medium text-foreground truncate ml-2">{record.teacher_name || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-tertiary">Teacher Signed</span>
                    {record.teacher_signed
                      ? <Badge className="bg-success/10 text-success border-0 gap-1"><Check className="h-3 w-3" /> Yes</Badge>
                      : <Badge variant="outline">Pending</Badge>}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border">
                  {canAdminSign && (
                    <Button
                      className="w-full"
                      onClick={() => { if (!sigProfile) setShowSigSetup(true); else setShowSignDialog(true); }}
                      disabled={signing}
                    >
                      {signing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                      Approve &amp; Sign
                    </Button>
                  )}
                  {canRequestChanges && (
                    <Button variant="outline" className="w-full border-warning/40 text-warning hover:bg-warning/10 hover:text-warning" onClick={() => setShowChangesDialog(true)}>
                      <MessageSquare className="h-4 w-4 mr-2" /> Request Changes
                    </Button>
                  )}
                  {(canAdminSign || canRequestChanges) && (
                    <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setShowRejectDialog(true)}>
                      <X className="h-4 w-4 mr-2" /> Reject
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Workflow Timeline */}
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-sm">Workflow History</CardTitle></CardHeader>
            <CardContent>
              <WorkflowTimeline logs={auditLogs} record={record} />
            </CardContent>
          </Card>

          {/* Verify Link */}
          {record.verify_id && (
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
                  <Link2 className="h-4 w-4" /> Public Verification
                </p>
                <p className="text-xs text-muted-foreground mb-3">Anyone can verify this achievement using this link.</p>
                <Button size="sm" variant="outline" onClick={copyVerifyLink} className="w-full">
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Verify Link
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Audit Trail */}
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-sm">Audit Trail</CardTitle></CardHeader>
            <CardContent>
              <AuditTrail logs={auditLogs} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Signature Setup */}
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

      {/* Sign Confirm Dialog */}
      <SignatureConfirmDialog
        open={showSignDialog}
        onOpenChange={setShowSignDialog}
        sigProfile={sigProfile}
        record={record}
        userType={profile?.user_type}
        onConfirm={handleSign}
        disabled={signing}
      />

      {/* Fallback Sign Dialog */}
      <Dialog open={showSignDialog && !sigProfile} onOpenChange={setShowSignDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{profile?.user_type === 'admin' ? 'Sign & Approve Achievement' : 'Sign & Endorse Achievement'}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-xs text-warning bg-warning/5 rounded-lg p-3 mb-4 border border-warning/20">
              Signatures are permanent and cannot be edited or deleted.
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
            <p className="text-sm text-muted-foreground">Provide a reason for rejection. The student will be notified.</p>
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

      {/* Request Changes Dialog */}
      <Dialog open={showChangesDialog} onOpenChange={setShowChangesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Provide feedback for the student/teacher. The achievement will return to them for editing and resubmission. The same record is preserved.</p>
            <Textarea value={changesReason} onChange={e => setChangesReason(e.target.value)} rows={4} placeholder="Describe what needs to change..." />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowChangesDialog(false)}>Cancel</Button>
            <Button onClick={handleRequestChanges} disabled={requestingChanges}>
              {requestingChanges && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Request Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit & Resubmit Dialog */}
      <EditResubmitDialog
        open={showEditResubmit}
        onOpenChange={setShowEditResubmit}
        record={record}
        onDone={loadAll}
      />
    </div>
  );
}