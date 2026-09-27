import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import ProfileBadge from '@/components/publicProfile/ProfileBadge';
import {
  Shield, CheckCircle2, Trophy, ExternalLink, Sparkles,
  Calendar, Download, Link2, Hash, Network, FileCheck, Building2,
  Copy, AlertCircle, GraduationCap, Award, ArrowRight, PenTool,
  UserCheck, History, Users, Loader2, Share2, Trash2, BadgeCheck, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { METHOD_OPTIONS } from '@/lib/achievementRequests';
import { FIELD_LABELS } from '@/lib/credentialEdits';
import BrandHeader from '@/components/public/BrandHeader';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from 'lucide-react';

const METHOD_LABELS = Object.fromEntries(METHOD_OPTIONS.map((m) => [m.value, m.label]));

// Correction-history values are stored stringified — render them readably.
const showVal = (v) => {
  if (v === null || v === undefined || v === 'null') return '(empty)';
  try {
    const p = JSON.parse(v);
    return typeof p === 'string' ? p : String(p);
  } catch {
    return String(v);
  }
};

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
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(window.location.search);
  const verificationId = routeParams.verification_id || queryParams.get('id');

  // Verification-entry form (shown when no ID is in the URL yet)
  const [lookupInput, setLookupInput] = useState('');
  const [lookupError, setLookupError] = useState('');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareCardUrl, setShareCardUrl] = useState(null);
  const [shareCardBusy, setShareCardBusy] = useState(false);
  const [canModerate, setCanModerate] = useState(false);
  const [removingCover, setRemovingCover] = useState(false);

  useEffect(() => {
    if (!verificationId) { setLoading(false); return; } // entry form, not an error
    loadRecord();
  }, [verificationId]);

  // Entry form: accepts a bare verification ID (BW-2026-ABCD1234) or a
  // pasted verification URL, then routes to the credential page.
  const handleLookup = (e) => {
    e.preventDefault();
    const raw = lookupInput.trim();
    if (!raw) { setLookupError('Enter a verification ID or link.'); return; }
    const fromUrl = raw.match(/(?:\/verify\/|id=)([A-Za-z0-9-]+)/i);
    const id = (fromUrl ? fromUrl[1] : raw).toUpperCase();
    if (!/^[A-Za-z0-9-]{6,}$/.test(id)) {
      setLookupError("That doesn't look like a verification ID or link.");
      return;
    }
    setLookupError('');
    navigate(`/verify/${id}`);
  };

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
    setMeta('property', 'og:description', r.verification_mode === 'independent'
      ? `${r.student_name || 'Student'} · independently verified by ${r.independent_verifier?.name || 'a named verifier'}`
      : `${r.student_name || 'Student'} · issued by ${r.organisation_name || 'their organisation'}`);
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

  // No ID yet — the verification-entry screen (the footer's "Verify a
  // credential" lands here).
  if (!verificationId) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 accent-glow relative overflow-hidden">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-3">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Verify a credential</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Enter the verification ID (e.g. <span className="font-mono">BW-2026-ABCD1234</span>) or paste the
            verification link you were sent. No account needed.
          </p>
        </div>

        <Card className="surface-card">
          <CardContent className="p-6">
            <form onSubmit={handleLookup} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="verify-id" className="text-xs font-semibold text-tertiary uppercase tracking-wide">
                  Verification ID or link
                </label>
                <input
                  id="verify-id"
                  type="text"
                  value={lookupInput}
                  onChange={(e) => { setLookupInput(e.target.value); setLookupError(''); }}
                  placeholder="BW-2026-ABCD1234"
                  autoComplete="off"
                  autoFocus
                  className="w-full h-9 px-3 rounded-lg bg-secondary/60 border border-border text-sm text-foreground placeholder:text-tertiary focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-colors"
                />
              </div>
              {lookupError && (
                <p role="alert" className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /> {lookupError}
                </p>
              )}
              <Button type="submit" className="w-full">
                Verify credential <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Want to learn about BlockWard? <Link to="/" className="text-primary hover:underline">Go to homepage</Link>
        </p>
      </div>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-background">
      <BrandHeader />
      <div className="max-w-md mx-auto px-4 py-14 md:py-20 animate-fade-in">
        <Card className="w-full text-center surface-card">
          <CardContent className="py-12 px-6">
            <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">We can't verify this link</h1>
            <p className="text-muted-foreground mb-2 text-sm leading-relaxed">
              The verification ID doesn't match any published credential on BlockWard. If you were sent
              this link, check it was copied in full — or ask the holder for their current verification link.
            </p>
            {verificationId && (
              <p className="text-xs text-tertiary font-mono break-all mb-1">{verificationId}</p>
            )}
            <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
              <Button asChild variant="outline" size="sm">
                <Link to="/verify">Verify another credential</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/">Learn about BlockWard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // PRIVATE — its own clear message, nothing else shown.
  if (data.status === 'private') return (
    <div className="min-h-screen bg-background">
      <BrandHeader />
      <div className="max-w-md mx-auto px-4 py-14 md:py-20 animate-fade-in">
        <Card className="w-full text-center surface-card">
          <CardContent className="py-12 px-6">
            <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4 border border-border">
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">Private credential</h1>
            <p className="text-muted-foreground mb-6 text-sm leading-relaxed">{data.message || 'This credential exists, but its owner has made it private. Only they can share it.'}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button asChild variant="outline" size="sm">
                <Link to="/verify">Verify another credential</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/">Learn about BlockWard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const { record, teacherSignature, adminSignature, isVerified, isRevoked, message, chain } = data;
  const orgVerified = data.org_verified;
  // Two honest tiers: organisation-verified (a member org stands behind it)
  // vs independently verified (a named person does). They must never look alike.
  const independent = isVerified && record.verification_mode === 'independent';
  const iv = record.independent_verifier || null;
  const ivName = iv?.name || record.teacher_name;
  const ivRole = (iv?.role || '').replace(/_/g, ' ');
  const ivOrg = iv?.organisation_label || record.organisation_name;
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
      {/* Brand header — shared across all public BlockWard surfaces */}
      <BrandHeader />

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 space-y-6 animate-fade-in relative verify-ambient">

        {/* Status banner */}
        {data.status === 'hash_mismatch' ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="font-bold text-lg text-destructive">Content does not match its blockchain commitment</p>
              <p className="text-sm text-muted-foreground">
                The details shown below were recalculated and do NOT match the hash committed on-chain when this
                credential was anchored. Do not trust this credential in its current form.
              </p>
            </div>
          </div>
        ) : isRevoked ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="font-bold text-lg text-destructive">Achievement revoked</p>
              <p className="text-sm text-muted-foreground">{message || 'This achievement is no longer valid.'}</p>
              {record?.revocation?.revoked_at && (
                <p className="text-xs text-destructive/80 mt-1.5">
                  Revoked {format(new Date(record.revocation.revoked_at), 'MMMM d, yyyy')}
                  {record.revocation.revoked_by_name ? ` by ${record.revocation.revoked_by_name}` : ''}
                  {record.revocation.reason ? ` — "${record.revocation.reason}"` : ''}
                </p>
              )}
            </div>
          </div>
        ) : data.status === 'superseded' ? (
          <div className="rounded-2xl border border-warning/30 bg-warning/10 p-5 flex items-center gap-4">
            <History className="h-6 w-6 text-warning flex-shrink-0" />
            <div>
              <p className="font-semibold text-warning">A newer version exists</p>
              <p className="text-sm text-muted-foreground">
                {message || 'This credential has been corrected — a newer version exists on this same link.'}{' '}
                Re-open this link to view the current version, or contact the issuing organisation.
              </p>
            </div>
          </div>
        ) : independent ? (
          <div className="rounded-2xl border border-info/30 bg-info/10 p-6 flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-info/15 flex items-center justify-center flex-shrink-0">
              <UserCheck className="h-8 w-8 text-info" />
            </div>
            <div>
              <p className="font-bold text-2xl tracking-tight text-foreground">Independently verified</p>
              <p className="text-sm text-muted-foreground">
                Verified by {ivName || 'a named verifier'}{ivRole ? `, ${ivRole}` : ''}{ivOrg ? ` at ${ivOrg}` : ''} — a named person, not a BlockWard member organisation
              </p>
            </div>
          </div>
        ) : isVerified ? (
          <div className="rounded-2xl border border-success/25 bg-success/10 p-6 flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div>
              <p className="font-bold text-2xl tracking-tight text-foreground">Verified BlockWard</p>
              <p className="text-sm text-muted-foreground">
                {orgVerified === false
                  ? <>Signed by staff of {record.organisation_name || 'the issuing organisation'} — this organisation is still being verified by BlockWard</>
                  : <>Verified by {record.organisation_name || 'the issuing organisation'}, a BlockWard member organisation</>}
              </p>
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
                  {chain?.status === 'confirmed' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-success/10 border border-success/30 text-xs font-medium text-success">
                      <Network className="h-3 w-3" /> Blockchain verified · Sepolia testnet
                    </span>
                  )}
                  {record.nft_status === 'minted' && chain && !['confirmed', 'confirmed_legacy'].includes(chain.status) && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-secondary border border-border text-xs font-medium text-muted-foreground">
                      <Network className="h-3 w-3" /> Anchored — confirmation {chain.status === 'chain_unavailable' ? 'unavailable' : 'pending'}
                    </span>
                  )}
                  {record.nft_status === 'anchoring' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-warning/10 border border-warning/30 text-xs font-medium text-warning">
                      <Clock className="h-3 w-3" /> Anchoring to blockchain…
                    </span>
                  )}
                  {record.nft_status === 'failed' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-warning/10 border border-warning/30 text-xs font-medium text-warning">
                      <Clock className="h-3 w-3" /> Blockchain anchor failed
                    </span>
                  )}
                  {isVerified && (
                    independent ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-info/10 border border-info/30 text-xs font-medium text-info">
                        <UserCheck className="h-3 w-3" /> Independently verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-success/10 border border-success/30 text-xs font-medium text-success">
                        <BadgeCheck className="h-3 w-3" /> Organisation verified
                      </span>
                    )
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
              <div>
                <div className="flex items-start gap-3 py-2.5">
                  <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5 border border-border">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-tertiary uppercase tracking-wide">Recipient</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-sm font-medium text-foreground break-words">{record.student_name}</p>
                      {data.student_badge && (
                        <ProfileBadge
                          tier={data.student_badge.tier}
                          orgName={data.student_badge.org_name}
                          grantedAt={data.student_badge.granted_at}
                          size="sm"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
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

        {/* Correction transparency — visible, never hidden */}
        {isVerified && record.corrected_at && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex items-start gap-4">
            <div className="h-11 w-11 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              <History className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                Corrected on {format(new Date(record.corrected_at), 'MMMM d, yyyy')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                The corrected details were re-signed by the original verifier — you're viewing version {record.version}.
                The full correction history is shown below. Corrections are transparent, never hidden.
              </p>
            </div>
          </div>
        )}

        {/* Verification checks */}
        {isVerified && (
          <Card className="surface-card">
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2 uppercase tracking-wider text-tertiary">
                <Shield className="h-4 w-4 text-success" /> Verification Status
              </h2>
              <ul className="space-y-3">
                <CheckItem>{independent ? 'Named verifier attested' : 'Issuer verified'}</CheckItem>
                <CheckItem>Credential valid</CheckItem>
                <CheckItem>BlockWard secured</CheckItem>
                {chain?.status === 'confirmed' && <CheckItem>Blockchain commitment matches — anchored on Sepolia testnet</CheckItem>}
                {chain?.status === 'confirmed_legacy' && <CheckItem>Blockchain anchor present (legacy format — no content commitment)</CheckItem>}
                {chain?.status === 'pending' && record.nft_status !== 'anchoring' && (
                  <li className="flex items-center gap-2.5 text-sm">
                    <span className="h-5 w-5 rounded-full bg-warning/15 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-3.5 w-3.5 text-warning" />
                    </span>
                    <span className="text-muted-foreground">
                      Blockchain anchoring pending{orgVerified === false ? ' — the issuing organisation is awaiting BlockWard verification' : ''}
                    </span>
                  </li>
                )}
                {record.nft_status === 'anchoring' && (
                  <li className="flex items-center gap-2.5 text-sm">
                    <span className="h-5 w-5 rounded-full bg-warning/15 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-3.5 w-3.5 text-warning" />
                    </span>
                    <span className="text-muted-foreground">Blockchain anchoring in progress — the permanent on-chain commitment is being created</span>
                  </li>
                )}
                {(chain?.status === 'failed' || record.nft_status === 'failed') && (
                  <li className="flex items-center gap-2.5 text-sm">
                    <span className="h-5 w-5 rounded-full bg-warning/15 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-3.5 w-3.5 text-warning" />
                    </span>
                    <span className="text-muted-foreground">Blockchain anchoring failed — it can be retried by the issuing organisation</span>
                  </li>
                )}
                {chain?.status === 'anchor_invalid' && (
                  <li className="flex items-center gap-2.5 text-sm">
                    <span className="h-5 w-5 rounded-full bg-warning/15 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="h-3.5 w-3.5 text-warning" />
                    </span>
                    <span className="text-muted-foreground">The on-chain anchor could not be validated — no blockchain-verified claim is shown</span>
                  </li>
                )}
                {chain?.status === 'chain_unavailable' && (
                  <li className="flex items-center gap-2.5 text-sm">
                    <span className="h-5 w-5 rounded-full bg-warning/15 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-3.5 w-3.5 text-warning" />
                    </span>
                    <span className="text-muted-foreground">
                      Blockchain network temporarily unreachable — the on-chain commitment could not be re-checked just now
                    </span>
                  </li>
                )}
                {orgVerified === false && (
                  <li className="flex items-center gap-2.5 text-sm">
                    <span className="h-5 w-5 rounded-full bg-warning/15 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-3.5 w-3.5 text-warning" />
                    </span>
                    <span className="text-muted-foreground">Issuing organisation verification by BlockWard — pending</span>
                  </li>
                )}
              </ul>
              <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground leading-relaxed">
                {independent
                  ? `Independently verified credentials are signed by a named person outside BlockWard's organisation network. They carry that person's personal attestation — the full identity, method and timestamp are shown above — rather than an institutional guarantee from a member organisation.`
                  : `Organisation-verified credentials are signed by staff of a BlockWard member organisation and carry that organisation's institutional guarantee.`}
              </p>
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

        {/* Correction history — the transparent version chain */}
        {isVerified && record.correction_history?.length > 0 && (
          <Card className="surface-card">
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-4 flex items-center gap-2">
                <History className="h-4 w-4" /> Correction history
              </h2>
              <div className="space-y-4">
                {record.correction_history.map((c, i) => (
                  <div key={i} className="rounded-xl border border-border bg-secondary/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        Version {c.version} — approved by {c.approved_by || 'the original verifier'}
                      </p>
                      <span className="text-xs text-tertiary">
                        {format(new Date(c.corrected_at), 'd MMM yyyy, HH:mm')}
                      </span>
                    </div>
                    {c.reason && <p className="text-xs text-muted-foreground mt-1 italic">"{c.reason}"</p>}
                    <div className="mt-2 space-y-1.5">
                      {(c.changes || []).map((ch, j) => (
                        <div key={j} className="flex items-start gap-2 text-xs break-words min-w-0">
                          <span className="font-medium text-tertiary uppercase tracking-wide w-28 flex-shrink-0">
                            {FIELD_LABELS[ch.field] || ch.field}
                          </span>
                          <span className="text-muted-foreground line-through flex-1 min-w-0">{showVal(ch.old_value)}</span>
                          <ArrowRight className="h-3 w-3 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-foreground font-medium flex-1 min-w-0">{showVal(ch.new_value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {record.previous_anchor && (record.previous_anchor.transaction_hash || record.previous_anchor.token_id) && (
                  <p className="text-xs text-muted-foreground border-t border-border pt-3 leading-relaxed">
                    Version {(record.version || 2) - 1}'s blockchain anchor is preserved unchanged
                    {record.previous_anchor.token_id ? ` — token #${record.previous_anchor.token_id}` : ''}
                    {record.previous_anchor.transaction_hash ? ` · tx ${record.previous_anchor.transaction_hash.slice(0, 18)}…` : ''}.
                    Anchors are never mutated — each corrected version gets its own.
                  </p>
                )}
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

        {/* Technical details — the on-chain commitment. Collapsible so the
            page reads cleanly for non-technical viewers while everything
            remains one tap away. The summary status is always visible in the
            credential header above; this section never ADDS trust, it only
            substantiates it. */}
        {isVerified && (hasBlockchain || (chain && chain.status !== 'pending')) && (
          <Collapsible className="rounded-xl border border-border surface-card">
            <CollapsibleTrigger className="group w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-hover/40 transition-colors">
              <div>
                <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider flex items-center gap-2">
                  <Network className="h-4 w-4" /> Technical details
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Blockchain network, transaction anchor and content commitment (SHA-256)
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-tertiary flex-shrink-0 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-5 pb-5 border-t border-border pt-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {chain?.status === 'confirmed'
                    ? <>This credential's content commitment is anchored on <strong className="text-foreground">the Sepolia testnet</strong> (not mainnet). The on-chain entry is permanent and outside anyone's control — it cannot be quietly edited by the issuing organisation or by BlockWard. The displayed details were independently recalculated and match the committed hash.</>
                    : chain?.status === 'hash_mismatch'
                      ? 'The displayed details were recalculated and do NOT match the hash committed on-chain. Do not trust this credential in its current form.'
                      : chain?.status === 'chain_unavailable'
                        ? 'The blockchain network could not be reached just now, so the on-chain commitment could not be confirmed. No verified claim is shown until it can be.'
                        : chain?.status === 'confirmed_legacy'
                          ? 'This credential was anchored on-chain before the content-commitment format was introduced. The anchor itself is confirmed, but it carries no content hash to compare against.'
                          : chain?.status === 'anchor_invalid'
                            ? 'The on-chain anchor exists but could not be validated against this credential. No blockchain-verified claim is shown.'
                            : 'The on-chain commitment for this credential is still being created. Once anchored, its integrity can be re-checked here at any time.'}
                </p>
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border flex-shrink-0",
                  chain?.status === 'confirmed'
                    ? "bg-success/10 border-success/30 text-success"
                    : chain?.status === 'hash_mismatch'
                      ? "bg-destructive/10 border-destructive/30 text-destructive"
                      : "bg-warning/10 border-warning/30 text-warning"
                )}>
                  {chain?.status === 'confirmed' ? 'Blockchain verified'
                    : chain?.status === 'hash_mismatch' ? 'Hash mismatch'
                    : chain?.status === 'chain_unavailable' ? 'Chain unreachable'
                    : chain?.status === 'confirmed_legacy' ? 'Anchored (legacy)'
                    : chain?.status === 'anchor_invalid' ? 'Anchor invalid'
                    : 'Not confirmed'}
                </span>
              </div>
              <Field icon={Network} label="Network" value="Sepolia testnet" />
              {chain?.transaction_hash && <Field icon={Hash} label="Transaction hash" value={chain.transaction_hash} mono />}
              <Field icon={Hash} label="Token ID" value={chain?.token_id ? `#${chain.token_id}` : (record.token_id ? `#${record.token_id}` : null)} mono />
              <Field icon={Hash} label="Contract address" value={chain?.contract_address || record.contract_address} mono />
              {chain?.committed_hash && <Field icon={Hash} label="Content commitment (SHA-256)" value={`${chain.committed_hash.slice(0, 24)}…`} mono />}
              {chain?.checked_at && (
                <Field icon={Calendar} label="Last checked" value={format(new Date(chain.checked_at), 'PPP p')} />
              )}
              {chain?.transaction_hash && (
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <a href={`https://sepolia.etherscan.io/tx/${chain.transaction_hash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" /> View on Etherscan (Sepolia testnet)
                  </a>
                </Button>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Plain-language trust explainer — this page may be the first
            BlockWard surface a university, employer or verifier ever sees. */}
        {isVerified && (
          <Card className="surface-card">
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" /> About this verification
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                BlockWard is an independent network for verified achievements. When this achievement was
                verified, {independent ? 'a named person outside our organisation network' : 'staff at the issuing organisation'}{' '}
                signed the exact details you see above, and a tamper-proof fingerprint of those details was recorded
                on a public blockchain. Anyone can re-check that record at any time — no account, no login, and no
                need to take BlockWard's word for it.
              </p>
              <ul className="space-y-2.5 mt-4">
                {chain?.status === 'confirmed' && (
                  <CheckItem>The details shown were re-checked against the on-chain commitment just now</CheckItem>
                )}
                <CheckItem>Corrections are transparent — every version is shown, nothing is silently rewritten</CheckItem>
                <CheckItem>Revocation is permanent and public — a revoked credential can never quietly become valid again</CheckItem>
              </ul>
              <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground leading-relaxed">
                While BlockWard is in beta, anchors are recorded on a public test network (Sepolia) — this is
                labelled everywhere it appears. Full technical details — network, transaction and content
                hash — are in the Technical details section.
              </p>
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