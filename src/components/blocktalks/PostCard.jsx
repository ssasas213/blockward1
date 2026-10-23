import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  PartyPopper, Bookmark, Share2, ShieldCheck, Building2, MoreHorizontal,
  Flag, Trash2, Ban, ExternalLink, BadgeCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// PostCard — one BlockTalks feed post. Premium dark card, consistent with the
// BlockWard design system. The Blockward Verified badge renders ONLY when the
// server stamped the post verified from live credential state.
const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'misrepresented_verification', label: 'Misrepresented verification' },
  { value: 'other', label: 'Something else' },
];

export default function PostCard({ post, meEmail, onReact, onDelete, onBlock, onReport, busy }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [copied, setCopied] = useState(false);

  const celebrated = (post.celebrated_by || []).includes(meEmail);
  const saved = (post.saved_by || []).includes(meEmail);
  const isMine = (post.author_email || '').toLowerCase() === (meEmail || '').toLowerCase();
  const isOrg = post.author_kind === 'organisation';
  const verifyUrl = post.verification_id ? `/verify/${post.verification_id}` : null;
  const sharedAt = post.published_at ? format(new Date(post.published_at), 'd MMM yyyy') : null;

  const share = async () => {
    const text = `${post.author_name} shared a verified achievement: "${post.achievement_title}"${post.issuer_org ? `, verified by ${post.issuer_org}` : ''}.`;
    const url = verifyUrl ? `${window.location.origin}${verifyUrl}` : '';
    try {
      if (navigator.share && url) await navigator.share({ title: 'Blockward Verified', text, url });
      else { await navigator.clipboard.writeText(url || text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* user dismissed */ }
  };

  return (
    <article className="rounded-2xl border border-border surface-card overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <InitialsAvatar name={post.author_name || ''} src={post.author_avatar_url || null} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-foreground truncate">
              {isOrg ? post.org_name || post.author_name : post.author_name}
            </span>
            {isOrg && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-primary">
                <BadgeCheck className="h-3 w-3" /> Official issuer
              </span>
            )}
            {post.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[12px] font-semibold text-primary">
                <ShieldCheck className="h-3 w-3" /> Blockward Verified
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-tertiary">
            {sharedAt ? `Shared ${sharedAt}` : 'Awaiting holder approval'}
            {post.issuer_org && !isOrg ? ` · ${post.issuer_org}` : ''}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Post options"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isMine ? (
              <DropdownMenuItem onClick={() => onDelete(post)} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Delete post
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={() => { setReason('spam'); setReportOpen(true); }}>
                  <Flag className="h-4 w-4 mr-2" /> Report post
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onBlock(post)} className="text-destructive">
                  <Ban className="h-4 w-4 mr-2" /> Block {post.author_name || 'this member'}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Body */}
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        {post.caption && <p className="mb-3 text-sm leading-relaxed text-foreground whitespace-pre-line">{post.caption}</p>}
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          {post.banner_url && (
            <div className="mb-3 overflow-hidden rounded-lg" style={{ aspectRatio: '16 / 9' }}>
              <img src={post.banner_url} alt={post.achievement_title} className="h-full w-full object-cover" loading="lazy" />
            </div>
          )}
          <h3 className="card-title sm:text-base">{post.achievement_title}</h3>
          {post.issuer_org && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-tertiary">
              <Building2 className="h-3.5 w-3.5" /> {post.issuer_org}
            </p>
          )}
          <p className="mt-1 text-[12px]">
            {post.verified
              ? <span className="font-medium text-primary">Verified achievement</span>
              : <span className="text-tertiary">Unverified achievement</span>}
          </p>
          {verifyUrl && (
            <Button variant="outline" size="sm" asChild className="mt-3">
              <Link to={verifyUrl}>
                <ExternalLink className="h-3.5 w-3.5" /> View verification
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 border-t border-border px-2 py-1.5 sm:px-3">
        <Button
          variant="ghost" size="sm"
          className={cn("gap-1.5", celebrated && "text-primary")}
          disabled={!!busy}
          onClick={() => onReact(post, 'celebrate')}
        >
          <PartyPopper className="h-4 w-4" />
          Celebrate{(post.celebrated_by || []).length ? ` ${(post.celebrated_by || []).length}` : ''}
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5" disabled={!!busy} onClick={share}>
          <Share2 className="h-4 w-4" /> {copied ? 'Copied' : 'Share'}
        </Button>
        <Button
          variant="ghost" size="sm"
          className={cn("gap-1.5 ml-auto", saved && "text-primary")}
          disabled={!!busy}
          onClick={() => onReact(post, 'save')}
        >
          <Bookmark className={cn("h-4 w-4", saved && "fill-current")} /> {saved ? 'Saved' : 'Save'}
        </Button>
      </div>

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report this post</DialogTitle>
            <DialogDescription>
              Reports go to the BlockWard moderation team. The author is not told who reported.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <div className="grid gap-2">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setReason(r.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      reason === r.value ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-hover"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Details (optional)</Label>
              <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={500} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button onClick={() => { onReport(post, reason, details); setReportOpen(false); }}>
              <Flag className="h-4 w-4" /> Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}