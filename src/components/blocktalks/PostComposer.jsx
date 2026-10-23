import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ShieldCheck, Building2, MessagesSquare, PartyPopper, Loader2, Check, ExternalLink,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import InitialsAvatar from '@/components/ui/InitialsAvatar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// PostComposer — the BlockTalks post composer, shared by the feed's
// "Share an achievement" entry point and the /Achievements action menu.
//
// Two modes:
//   individual  — pick one of YOUR verified achievements, caption, preview,
//                 then explicit confirmation publishes to the feed.
//   organisation — pick a credential YOUR verified organisation issued; the
//                 post is sent to the holder for approval before it publishes.
//
// Privacy: only verified, public-facing achievements are offered. Evidence
// files are never included — posts carry the holder's own decorative banner
// and the public verification link only.

const MAX_CAPTION = 500;

export default function PostComposer({
  open, onOpenChange, profile, meEmail,
  shareable = [],        // individual verified achievements
  orgs = [],             // [{ org_id, org_name, credentials: [...] }] for org mode
  preselectedRef = null, // achievement ref auto-selected (from /Achievements menu)
  onPublished,
}) {
  const [mode, setMode] = useState('individual');
  const [ref, setRef] = useState(preselectedRef);
  const [orgId, setOrgId] = useState(orgs[0]?.org_id || null);
  const [credentialId, setCredentialId] = useState(null);
  const [caption, setCaption] = useState('');
  const [stage, setStage] = useState('edit'); // edit | confirm
  const [publishing, setPublishing] = useState(false);

  const hasOrgs = orgs.length > 0;
  const effectiveMode = hasOrgs ? mode : 'individual';

  // Keep the selection in sync with whoever opened the composer (the
  // /Achievements menu preselects; the feed's button opens unselected).
  useEffect(() => { setRef(preselectedRef); setStage('edit'); }, [preselectedRef]);

  const selectedItem = useMemo(
    () => shareable.find((s) => s.ref === ref) || null,
    [shareable, ref],
  );
  const activeOrg = orgs.find((o) => o.org_id === orgId) || null;
  const selectedCredential = useMemo(
    () => (activeOrg?.credentials || []).find((c) => c.id === credentialId) || null,
    [activeOrg, credentialId],
  );

  const reset = () => { setStage('edit'); setCaption(''); setRef(preselectedRef); setCredentialId(null); };
  const close = (o) => { if (!o) reset(); onOpenChange(o); };

  const authorName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : meEmail;

  const preview = effectiveMode === 'organisation'
    ? (selectedCredential ? {
        author_name: activeOrg.org_name,
        isOrg: true,
        title: selectedCredential.title,
        org: activeOrg.org_name,
        banner: null,
        verified: true,
        date: new Date(),
      } : null)
    : (selectedItem ? {
        author_name: authorName,
        isOrg: false,
        title: selectedItem.title,
        org: selectedItem.org,
        banner: selectedItem.banner,
        verified: true,
        date: new Date(),
      } : null);

  const publish = async () => {
    setPublishing(true);
    try {
      if (effectiveMode === 'organisation') {
        await base44.functions.invoke('blocktalkAction', {
          action: 'publish_org', org_id: orgId, credential_id: credentialId, caption,
        });
        toast.success('Sent to the holder for approval — the post goes live once they consent.');
      } else {
        await base44.functions.invoke('blocktalkAction', {
          action: 'publish',
          achievement_ref: selectedItem.ref,
          title: selectedItem.title,
          category: selectedItem.category || null,
          issuer_org: selectedItem.org || null,
          banner_url: selectedItem.banner || null,
          verification_id: selectedItem.verification_id || null,
          caption,
        });
        toast.success('Published to BlockTalks');
      }
      onPublished?.();
      close(false);
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Could not publish');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessagesSquare className="h-4 w-4 text-primary" /> Share to BlockTalks
          </DialogTitle>
          <DialogDescription>
            Where achievements start conversations. Only verified achievements can be shared, and
            nothing is published without your explicit confirmation.
          </DialogDescription>
        </DialogHeader>

        {/* Author mode toggle */}
        {hasOrgs && (
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-[12px] text-tertiary">Post as</Label>
            <button
              onClick={() => { setMode('individual'); setStage('edit'); }}
              className={cn("rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                effectiveMode === 'individual' ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-hover")}
            >
              Yourself
            </button>
            {orgs.map((o) => (
              <button
                key={o.org_id}
                onClick={() => { setMode('organisation'); setOrgId(o.org_id); setStage('edit'); }}
                className={cn("rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                  effectiveMode === 'organisation' && orgId === o.org_id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-hover")}
              >
                {o.org_name}
              </button>
            ))}
          </div>
        )}

        {stage === 'edit' && (
          <div className="space-y-4">
            {effectiveMode === 'individual' ? (
              <div className="space-y-1.5">
                <Label>Choose a verified achievement</Label>
                {shareable.length === 0 ? (
                  <p className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                    No verified achievements yet. Once an achievement is Blockward Verified it
                    appears here and can be shared.
                  </p>
                ) : (
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {shareable.map((s) => (
                      <button
                        key={s.ref}
                        onClick={() => setRef(s.ref)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                          ref === s.ref ? "border-primary bg-primary/10" : "border-border hover:bg-hover"
                        )}
                      >
                        {ref === s.ref
                          ? <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                          : <ShieldCheck className="h-4 w-4 flex-shrink-0 text-tertiary" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{s.title}</span>
                          <span className="block text-[12px] text-tertiary truncate">
                            {s.org || 'Independent'} · Blockward Verified
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {!preselectedRef && shareable.length === 0 && null}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Choose a credential your organisation verified</Label>
                {(activeOrg?.credentials || []).length === 0 ? (
                  <p className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                    No anchored credentials yet — recognition posts become available once your
                    organisation has issued and anchored credentials.
                  </p>
                ) : (
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {(activeOrg?.credentials || []).filter((c) => c.anchor_status === 'confirmed' && c.status === 'active').map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCredentialId(c.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                          credentialId === c.id ? "border-primary bg-primary/10" : "border-border hover:bg-hover"
                        )}
                      >
                        {credentialId === c.id
                          ? <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                          : <Building2 className="h-4 w-4 flex-shrink-0 text-tertiary" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{c.title}</span>
                          <span className="block text-[12px] text-tertiary truncate">
                            {c.holder_display_name || 'Holder'} · {c.bw_id}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[12px] text-tertiary">
                  The holder approves the post before it goes live.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Caption (optional)</Label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                maxLength={MAX_CAPTION}
                placeholder="Add a short professional caption…"
              />
              <p className="text-[12px] text-tertiary">{caption.length}/{MAX_CAPTION}</p>
            </div>
          </div>
        )}

        {stage === 'confirm' && preview && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ready to publish. This is exactly what the feed will show:
            </p>
            <div className="rounded-2xl border border-border surface-card overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <InitialsAvatar name={preview.author_name || ''} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{preview.author_name}</span>
                    {preview.isOrg && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[12px] text-primary">Official issuer</span>
                    )}
                    {preview.verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[12px] font-semibold text-primary">
                        <ShieldCheck className="h-3 w-3" /> Blockward Verified
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-tertiary">
                    Shared {format(preview.date, 'd MMM yyyy')}
                    {preview.org && !preview.isOrg ? ` · ${preview.org}` : ''}
                  </p>
                </div>
              </div>
              <div className="px-4 pb-4">
                {caption && <p className="mb-3 text-sm text-foreground whitespace-pre-line">{caption}</p>}
                <div className="rounded-xl border border-border bg-secondary/40 p-4">
                  {preview.banner && (
                    <div className="mb-3 overflow-hidden rounded-lg" style={{ aspectRatio: '16 / 9' }}>
                      <img src={preview.banner} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <h4 className="card-title sm:text-base">{preview.title}</h4>
                  {preview.org && (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-tertiary">
                      <Building2 className="h-3.5 w-3.5" /> {preview.org}
                    </p>
                  )}
                  <p className="mt-1 text-[12px] font-medium text-primary">Verified achievement</p>
                  {effectiveMode === 'individual' && selectedItem?.verification_id && (
                    <p className="mt-2 inline-flex items-center gap-1 text-[12px] text-tertiary">
                      <ExternalLink className="h-3 w-3" /> Links to /verify/{selectedItem.verification_id}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {stage === 'edit' ? (
            <>
              <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button
                disabled={effectiveMode === 'organisation' ? !selectedCredential : !selectedItem}
                onClick={() => setStage('confirm')}
              >
                <PartyPopper className="h-4 w-4" /> Preview
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStage('edit')} disabled={publishing}>Back</Button>
              <Button onClick={publish} disabled={publishing}>
                {publishing
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ShieldCheck className="h-4 w-4" />}
                {effectiveMode === 'organisation' ? 'Send for holder approval' : 'Publish to BlockTalks'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}