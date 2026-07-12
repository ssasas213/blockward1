import React, { useState } from 'react';
import { FileText, PenLine, ShieldCheck, HardDrive, Link2, ArrowRight, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const stages = [
  { icon: FileText, title: 'Achievement Created', desc: 'A record is created with evidence attached.' },
  { icon: PenLine, title: 'Teacher Signs', desc: 'The verifier reviews and digitally signs the record.' },
  { icon: ShieldCheck, title: 'Admin Approves', desc: 'The organisation authorises the achievement.' },
  { icon: HardDrive, title: 'Archived', desc: 'Permanently stored in Google Drive and on-chain.' },
  { icon: Link2, title: 'Verified', desc: 'Anyone can verify authenticity via a public link.' },
];

export default function InteractiveDemo() {
  const [step, setStep] = useState(0);
  const isComplete = step === stages.length - 1;
  const current = stages[step];

  const next = () => setStep((s) => Math.min(s + 1, stages.length - 1));
  const reset = () => setStep(0);

  return (
    <section id="demo" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-950 border-t border-white/10">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm text-slate-500 font-medium mb-2">Interactive Demo</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight mb-3">
            See the verification lifecycle
          </h2>
          <p className="text-base text-slate-400 max-w-2xl mx-auto">
            Click through each stage to watch an achievement become a permanent, verifiable credential.
          </p>
        </div>

        {/* progress steps */}
        <div className="flex items-center justify-between mb-10 max-w-3xl mx-auto">
          {stages.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => setStep(i)}
                className="flex flex-col items-center gap-2 group"
                aria-label={`Step ${i + 1}: ${s.title}`}
              >
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center border transition-colors ${
                    i <= step
                      ? 'bg-white border-white'
                      : 'bg-slate-900 border-white/15'
                  }`}
                >
                  {i < step ? (
                    <CheckCircle2 className="h-4 w-4 text-slate-900" />
                  ) : (
                    <s.icon className={`h-4 w-4 ${i <= step ? 'text-slate-900' : 'text-slate-500'}`} />
                  )}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i <= step ? 'text-white' : 'text-slate-500'}`}>
                  {s.title}
                </span>
              </button>
              {i < stages.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${i < step ? 'bg-white/30' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        {/* stage card */}
        <div className="max-w-xl mx-auto">
          <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center">
            <div className="inline-flex h-12 w-12 rounded-xl bg-white/10 items-center justify-center mb-4">
              <current.icon className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{current.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">{current.desc}</p>
          </div>
        </div>

        {/* controls */}
        <div className="flex items-center justify-center gap-3 mt-6">
          {isComplete ? (
            <Button onClick={reset} variant="outline" className="border-white/20 text-white bg-transparent hover:bg-white/10">
              <RotateCcw className="mr-2 h-4 w-4" />
              Restart Demo
            </Button>
          ) : (
            <Button onClick={next} className="bg-white text-slate-900 hover:bg-slate-200">
              {step === 0 ? 'Start Demo' : 'Next Stage'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}