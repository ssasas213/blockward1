import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import {
  Shield, CheckCircle2, Trophy, ExternalLink, Sparkles,
  Calendar, Download, Link2, Hash, Network, FileCheck, Building2,
  Copy, AlertCircle, GraduationCap, Award, ArrowRight, PenTool,
  UserCheck, History, Users, Loader2, Share2, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { METHOD_OPTIONS } from '@/lib/achievementRequests';

const METHOD_LABELS = Object.fromEntries(METHOD_OPTIONS.map((m) => [m.value, m.label]));

const CATEGORY_ACCENT = {
  academic: 'text-accent-blue',
  sports: 'text-success',
  arts: 'text-accent',
  leadership: 'text-primary',
  community: 'text-warning',
  behaviour: 'text-destructive',
  special: 'text-primary',
};

const CATEGORY_ICONS = {
  academic: GraduationCap, sports: Trophy, arts: Sparkles,
  leadership: Shield, community: Building2, behaviour: AlertCircle, special: Award,
};

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function CheckItem({ children }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span className="h-5 w-5 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
      </span>
      <span className="text-muted-foreground">{children}</span>
    </li>
  );
}

function Field({ icon: Icon, label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5 border border-border">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-tertiary uppercase tracking-wide">{label}</p>
        <p className={cn("text-sm font-medium text-foreground break-words mt-0.5", mono && "font-mono")}>{value}</p>
      </div>
    </div>
  );
}

export default function Verify() {
  const routeParams = useParams();
  const queryParams = new URLSearchParams(window.location.search);
  const verificationId = routeParams.verification_id || queryParams.get('id');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareCardUrl, setShareCardUrl] = useState(null);
  const [shareCardBusy, setShareCardBusy] = useState(false);
  const [canModerate, setCanModerate] = useState(false);
  const [removingCover, setRemovingCover] = useState(false);

  useEffect(() => {
    if (!verificationId) { setNotFound(true); setLoading(false); return; }
    loadRecord();
  }, [verificationId]);

  const loadRecord = async () => {
    try {
      const response = await base44.functions.invoke('publicVerify', { verification_id: verificationId });
      const result = response.data;
      if (!result.ok) { setNotFound(true); setLoading(false); return; }
      setCanModerate(!!result.can_moderate);
      setData(result);
    } catch (e) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Rich link previews (OG tags) + the server-rendered share card, generated
  // once and cached server-side.
  useEffect(() => {
    if (!data?.ok || !data.isVerified || !data.record) return;
    const r = data.record;
    document.title = `${r.achievement_title} — verified · BlockWard`;
    setMeta('property', 'og:title', `${r.achievement_title} — verified achievement`);
    setMeta('property', 'og:description', `${r.student_name || 'Student'} · issued by ${r.organisation_name || 'their organisation'}`);
    setMeta('property', 'og:url', window.location.href);
    setMeta('property', 'og:type', 'website');
    setMeta('name', 'twitter:card', 'summary_large_image');
    base44.functions.invoke('generateProfileCard', { variant: 'achievement', verification_id: verificationId })
      .then((res) => {
        if (res.data?.ok && res.data.url) {
          setShareCardUrl(res.data.url);
          setMeta('property', 'og:image', res.data.url);
        }
      })
      .catch(() => {});
    return () => { document.title = 'BlockWard — Verified Achievements'; };
  }, [data]);

  const downloadShareCard = async () => {
    if (!shareCardUrl) return;
    setShareCardBusy(true);
    try {
      const blob = await (await fetch(shareCardUrl)).blob();
      const link = document.createElement('a');
      link.download = `blockward-${verificationId}.png`;
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    } finally {
      setShareCardBusy(false);
    }
  };

  // Organisation admins of the issuing org can remove a student-uploaded cover
  // image from this credential (moderation). Authorisation and the audit log
  // live server-side in removeAchievementCover.
  const removeCover = async () => {
    setRemovingCover(true);
    try {
      const res = await base44.functions.invoke('removeAchievementCover', { verification_id: verificationId });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Failed to remove cover image');
      toast.success('Cover image removed');
      loadRecord();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to remove cover image');
    } finally {
      setRemovingCover(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center surface-card">
        <CardContent className="py-16">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Achievement Not Found</h1>
          <p className="text-muted-foreground mb-4 text-sm">This verification link is invalid or the achievement has been removed.</p>
          <p className="text-xs text-tertiary font-mono break-all">ID: {verificationId || 'none'}</p>
        </CardContent>
      </Card>
    </div>
  );

  const { record, teacherSignature, adminSignature, isVerified, isRevoked, message } = data;
  const CategoryIcon = CATEGORY_ICONS[record.achievement_category] || Award;
  const accent = CATEGORY_ACCENT[record.achievement_category] || 'text-primary';
  const evidenceIsImage = record.evidence_file_url && record.evidence_file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const hasBlockchain = record.token_id || record.transaction_hash;
  const networkKey = (record.blockchain_network || '').toLowerCase();
  const explorer = networkKey.includes('amoy')
    ? { base: 'https://amoy.polygonscan.com', name: 'PolygonScan (Amoy testnet)' }
    : networkKey.includes('polygon')
      ? { base: 'https://polygonscan.com', name: 'PolygonScan' }
      : { base: 'https://sepolia.etherscan.io', name: 'Etherscan (Sepolia testnet)' };
  const explorerUrl = record.transaction_hash
    ? `${explorer.base}/tx/${record.transaction_hash}`
    : record.contract_address
      ? `${explorer.base}/address/${record.contract_address}`
      : null;
  const achievedDate = record.date_achieved ? format(new Date(record.date_achieved), 'MMMM d, yyyy') : null;
  const approvedDate = record.date_approved ? format(new Date(record.date_approved), 'MMMM d, yyyy') : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Brand header */}
      <header className="border-b border-border bg-secondary/40 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-foreground tracking-tight">BlockWard</span>
          </div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            Learn about BlockWard <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 space-y-6 animate-fade-in relative verify-ambient">

        {/* Status banner */}
        {isRevoked ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="font-bold text-lg text-destructive">Achievement Revoked</p>
              <p className="text-sm text-muted-foreground">{message || 'This achievement is no longer valid.'}</p>
            </div>
          </div>
        ) : isVerified ? (
          <div className="rounded-2xl border border-success/25 bg-success/10 p-6 flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div>
              <p className="font-bold text-2xl tracking-tight text-foreground">Verified BlockWard</p>
              <p className="text-sm text-muted-foreground">Authentic credential, secured and independently verifiable</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-warning/30 bg-warning/10 p-5 flex items-center gap-4">
            <AlertCircle className="h-6 w-6 text-warning flex-shrink-0" />
            <div>
              <p className="font-semibold text-warning">Not Yet Fully Verified</p>
              <p className="text-sm text-muted-foreground">{message || 'This achievement is still in the approval process.'}</p>
            </div>
          </div>
        )}

        {/* Premium credential card */}
        <Card className={cn("surface-card overflow-hidden", isVerified && "verified-glow")}>
          <div className="h-1 bg-gradient-to-r from-primary via-brand-pink to-accent" />
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className={cn("w-28 h-28 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 border border-border flex items-center justify-center flex-shrink-0")}>
                {record.achievement_image ? (
                  <img src={record.achievement_image} alt="" className="w-full h-full rounded-2xl object-cover" />
                ) : evidenceIsImage ? (
                  <img src={record.evidence_file_url} alt="" className="w-full h-full rounded-2xl object-cover" />
                ) : (
                  <CategoryIcon className={cn("h-12 w-12", accent)} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-secondary border border-border text-xs font-medium text-muted-foreground capitalize">
                    {record.achievement_category}
                  </span>
                  {record.nft_status === 'minted' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
                      <Network className="h-3 w-3" /> Secured
                    </span>
                  )}
                  {record.student_requested && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-xs font-medium text-accent">
                      <UserCheck className="h-3 w-3" /> Requested by student
                    </span>
                  )}
                  {record.is_team_credential && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-secondary border border-border text-xs font-medium text-muted-foreground">
                      <Users className="h-3 w-3" /> Team achievement{record.participant_role ? ` · ${record.participant_role}` : ''}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-2">{record.achievement_title}</h1>
                {record.achievement_description && <p className="text-muted-foreground text-sm leading-relaxed">{record.achievement_description}</p>}
                {achievedDate && (
                  <p className="text-xs text-tertiary flex items-center gap-1.5 mt-3">
                    <Calendar className="h-3.5 w-3.5" /> Achieved {achievedDate}
                  </p>
                )}
                {record.team_slug && (
                  <Link to={`/team/${record.team_slug}`} className="text-sm text-primary hover:underline flex items-center gap-1.5 mt-3">
                    <Users className="h-4 w-4" /> View the shared team record
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-x-8 divide-y sm:divide-y-0 sm:[&>*:nth-child(odd)]:border-r sm:[&>*]:sm:pr-8">
              <div><Field icon={Building2} label="Recipient" value={record.student_name} /></div>
              <div><Field icon={Trophy} label="Issuing Organisation" value={record.organisation_name} /></div>
              <div className="sm:pt-2"><Field icon={PenTool} label="Verifier" value={record.teacher_name} /></div>
              <div className="sm:pt-2"><Field icon={Shield} label="Authoriser" value={record.admin_name} /></div>
              <div className="sm:pt-2"><Field icon={FileCheck} label="Date Approved" value={approvedDate} /></div>
              <div className="sm:pt-2"><Field icon={Hash} label="Verification ID" value={record.verification_id || verificationId} mono /></div>
            </div>

            {canModerate && record.achievement_image && (
              <div className="mt-6 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Organisation admin — this public cover image was uploaded by the student. Removing it is audited.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={removeCover}
                  disabled={removingCover}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  {removingCover ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                  Remove cover image
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verification checks */}
        {isVerified && (
          <Card className="surface-card">
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2 uppercase tracking-wider text-tertiary">
                <Shield className="h-4 w-4 text-success" /> Verification Status
              </h2>
              <ul className="space-y-3">
                <CheckItem>Issuer verified</CheckItem>
                <CheckItem>Credential valid</CheckItem>
                <CheckItem>BlockWard secured</CheckItem>
                {hasBlockchain && <CheckItem>Blockchain anchored</CheckItem>}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Signatures */}
        {(teacherSignature || adminSignature) && (
          <Card className="surface-card">
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-4 flex items-center gap-2">
                <PenTool className="h-4 w-4" /> Signatures
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {teacherSignature && (
                  <div className="rounded-xl border border-border bg-secondary/40 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Verifier</span>
                      <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3 w-3" /> Signed</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{teacherSignature.signer_name}</p>
                    {teacherSignature.signature_type === 'drawn'
                      ? <img src={teacherSignature.signature_value} alt="signature" className="h-12 mt-2 rounded bg-background border border-border p-1" />
                      : <p className="text-xl italic text-foreground mt-1" style={{ fontFamily: 'Georgia, serif' }}>{teacherSignature.signature_value}</p>}
                  </div>
                )}
                {adminSignature && (
                  <div className="rounded-xl border border-border bg-secondary/40 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Authoriser</span>
                      <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3 w-3" /> Signed</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{adminSignature.signer_name}</p>
                    {adminSignature.signature_type === 'drawn'
                      ? <img src={adminSignature.signature_value} alt="signature" className="h-12 mt-2 rounded bg-background border border-border p-1" />
                      : <p className="text-xl italic text-foreground mt-1" style={{ fontFamily: 'Georgia, serif' }}>{adminSignature.signature_value}</p>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Student-requested verification chain */}
        {isVerified && record.signer_chain?.length > 0 && (
          <Card className="surface-card">
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-4 flex items-center gap-2">
                <History className="h-4 w-4" /> Verification chain
              </h2>
              <div className="space-y-0">
                {record.signer_chain.map((signer, i) => (
                  <div key={i} className="relative flex gap-4 pb-5 last:pb-0">
                    {i < record.signer_chain.length - 1 && (
                      <span className="absolute left-[13px] top-8 bottom-0 w-px bg-border" />
                    )}
                    <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 z-10">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <p className="text-sm font-semibold text-foreground">{signer.name || 'Signer'}</p>
                        <span className="text-xs text-tertiary">{signer.role}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {METHOD_LABELS[signer.method] || signer.method?.replace(/_/g, ' ') || 'Verified'}
                        {signer.method_note && ` — ${signer.method_note}`}
                      </p>
                      <p className="text-xs text-tertiary mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {signer.attestation && <><CheckCircle2 className="h-3 w-3 text-success" /> Attested</>}
                        {signer.timestamp && `· ${format(new Date(signer.timestamp), 'd MMM yyyy, HH:mm')}`}
                        {signer.ip_country && ` · ${signer.ip_country}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Evidence */}
        {isVerified && evidenceIsImage && (
          <Card className="surface-card">
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileCheck className="h-4 w-4" /> Evidence
              </h2>
              <img src={record.evidence_file_url} alt="Evidence" className="w-full max-h-80 object-contain rounded-xl border border-border" />
            </CardContent>
          </Card>
        )}

        {/* Certificate */}
        {isVerified && record.certificate_url && (
          <Card className="surface-card">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Certificate</p>
                  <p className="text-xs text-muted-foreground">Download the official certificate</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={record.certificate_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                  Download <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Blockchain record — full technical detail for employers and universities */}
        {isVerified && hasBlockchain && (
          <Card className="surface-card">
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-2 flex items-center gap-2">
                <Network className="h-4 w-4" /> Blockchain record
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                This credential is anchored to a public ledger. The entry below is permanent — it cannot be
                edited, deleted or faked by anyone, including the issuing organisation or BlockWard.
              </p>
              <Field icon={Network} label="Network" value={record.blockchain_network} />
              {record.transaction_hash && <Field icon={Hash} label="Transaction Hash" value={record.transaction_hash} mono />}
              <Field icon={Hash} label="Token ID" value={record.token_id ? `#${record.token_id}` : null} mono />
              <Field icon={Hash} label="Contract Address" value={record.contract_address} mono />
              {record.date_delivered && (
                <Field icon={Calendar} label="Recorded At" value={format(new Date(record.date_delivered), 'PPP p')} />
              )}
              {explorerUrl && (
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" /> View on {explorer.name}
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Public URL */}
        <Card className="surface-card">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="h-4 w-4 text-tertiary flex-shrink-0" />
                <span className="text-xs text-tertiary font-medium">Public URL</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-muted-foreground truncate font-mono">{record.public_verification_url || window.location.href}</span>
                <Button variant="ghost" size="icon" onClick={copyUrl} className="h-7 w-7 flex-shrink-0">
                  {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2 min-w-0">
                <Share2 className="h-4 w-4 text-tertiary flex-shrink-0" />
                <span className="text-xs text-tertiary font-medium">Share card</span>
              </div>
              <Button variant="outline" size="sm" onClick={downloadShareCard} disabled={!shareCardUrl || shareCardBusy} className="flex-shrink-0">
                {shareCardBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                Download image
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center pb-8">
          <p className="text-xs text-tertiary">
            Verified through <span className="font-semibold text-primary">BlockWard</span>
          </p>
        </div>
      </div>
    </div>
  );
}