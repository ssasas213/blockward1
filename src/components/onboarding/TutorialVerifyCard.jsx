import { ShieldCheck, Hash } from 'lucide-react';

export default function TutorialVerifyCard() {
  // deterministic QR-style grid
  const cells = Array.from({ length: 49 }, (_, i) => (Math.sin(i * 12.9898) * 43758.5453) % 1 > 0.45);
  return (
    <div className="w-[300px] max-w-full rounded-xl surface-card overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-primary via-brand-pink to-accent" />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success/20 border border-success/40 text-[11px] font-semibold text-success shadow-[0_0_10px_hsl(142_71%_45%/0.3)]">
            <ShieldCheck className="h-3 w-3" /> Verified
          </span>
          <span className="text-[11px] text-tertiary">BlockWard Credential</span>
        </div>
        <p className="text-sm font-semibold text-foreground mb-3">Top in Mathematics — Term 1</p>
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-7 gap-0.5 p-1.5 rounded-md bg-background/60 border border-border">
            {cells.map((on, i) => (
              <span key={i} className={`h-2 w-2 rounded-[1px] ${on ? 'bg-foreground/80' : 'bg-transparent'}`} />
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground space-y-0.5">
            <p className="flex items-center gap-1"><Hash className="h-3 w-3" /> <span className="font-mono">BW-2026-ABCD1234</span></p>
            <p className="text-tertiary">blockward.me/verify</p>
          </div>
        </div>
      </div>
    </div>
  );
}