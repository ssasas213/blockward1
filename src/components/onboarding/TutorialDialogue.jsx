import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Play, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TutorialDialogue({ step, index, total, onBack, onNext, onSkip, onStart, ctaLabel, isFinal }) {
  const isWelcome = step.id === 'welcome';
  return (
    <div className="pointer-events-auto w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl p-[1px] bg-gradient-to-br from-brand-violet/60 via-primary/40 to-brand-pink/50 shadow-[0_12px_44px_rgba(0,0,0,0.45)]">
      <div className="rounded-2xl bg-card/95 backdrop-blur-xl border border-border p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{step.title}</p>
          <button onClick={onSkip} className="text-tertiary hover:text-foreground transition-colors" aria-label="Skip tour">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[15px] leading-relaxed text-foreground/95 mb-4">{step.body}</p>

        {/* progress */}
        <div className="flex items-center gap-1.5 mb-4">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === index ? "w-6 bg-gradient-to-r from-brand-violet to-brand-pink" :
              i < index ? "w-1.5 bg-primary/60" : "w-1.5 bg-border"
            )} />
          ))}
          <span className="ml-auto text-xs text-tertiary tabular-nums">{index + 1} of {total}</span>
        </div>

        <div className="flex items-center gap-2">
          {!isWelcome && !isFinal && (
            <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          )}
          <div className="flex-1" />
          {isWelcome ? (
            <>
              <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">Skip</Button>
              <Button size="sm" onClick={onStart}>
                <Play className="h-4 w-4" /> Start Tour
              </Button>
            </>
          ) : isFinal ? (
            <Button size="sm" onClick={onNext} className="bg-brand-gradient">
              <Check className="h-4 w-4" /> {ctaLabel || 'Get started'}
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">Skip</Button>
              <Button size="sm" onClick={onNext}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}