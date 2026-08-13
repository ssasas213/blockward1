import { ShieldCheck, GraduationCap } from 'lucide-react';

export default function TutorialCredential() {
  return (
    <div className="w-[260px] max-w-full rounded-xl surface-card overflow-hidden">
      <div className="h-16 relative bg-gradient-to-br from-primary/25 via-secondary to-brand-pink/15 flex items-center justify-center">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-brand-violet to-brand-pink flex items-center justify-center shadow-[0_0_18px_hsl(258_90%_66%/0.4)]">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-success/25 border border-success/50 text-[10px] font-semibold text-success">
          <ShieldCheck className="h-2.5 w-2.5" /> Verified
        </span>
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-foreground">Top in Mathematics</p>
        <p className="text-[11px] text-tertiary mt-0.5">Issued by Riverside Academy</p>
      </div>
    </div>
  );
}