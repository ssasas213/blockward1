import { Trophy, PenLine, ShieldCheck, HardDrive, CheckCircle2 } from 'lucide-react';

const NODES = [
  { label: 'Achievement', icon: Trophy, color: 'text-primary' },
  { label: 'Teacher Verification', icon: PenLine, color: 'text-brand-violet' },
  { label: 'Administrator Approval', icon: ShieldCheck, color: 'text-brand-pink' },
  { label: 'BlockWard Vault', icon: HardDrive, color: 'text-accent-blue' },
  { label: 'Verified Credential', icon: CheckCircle2, color: 'text-success' },
];

export default function TutorialLifecycle() {
  return (
    <div className="w-[300px] max-w-full">
      <style>{`
        @keyframes bw-flow-pulse { 0%{top:0%;opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{top:100%;opacity:0} }
        .bw-flow-line .bw-pulse{ animation: bw-flow-pulse 2.6s ease-in-out infinite; }
      `}</style>
      <div className="relative bw-flow-line pl-9">
        {/* vertical line */}
        <div className="absolute left-[14px] top-1 bottom-1 w-[2px] bg-gradient-to-b from-primary/40 via-brand-pink/40 to-success/50 rounded-full overflow-hidden">
          <div className="bw-pulse absolute left-0 w-[2px] h-6 bg-gradient-to-b from-brand-violet to-brand-pink rounded-full shadow-[0_0_10px_hsl(258_90%_66%/0.6)]" />
        </div>
        <div className="space-y-2.5">
          {NODES.map((n) => (
            <div key={n.label} className="flex items-center gap-2.5">
              <div className="absolute left-0 h-7 w-7 rounded-lg bg-secondary/80 border border-border flex items-center justify-center -ml-9">
                <n.icon className={`h-3.5 w-3.5 ${n.color}`} />
              </div>
              <span className="text-xs font-medium text-foreground/90">{n.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}