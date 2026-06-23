import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, PenLine, ShieldCheck, HardDrive, Link2, ArrowRight, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const stages = [
  { icon: FileText, title: 'Achievement Created', desc: 'A record is created with evidence attached.', color: 'from-blue-500 to-indigo-500' },
  { icon: PenLine, title: 'Teacher Signs', desc: 'The verifier reviews and digitally signs the record.', color: 'from-violet-500 to-purple-500' },
  { icon: ShieldCheck, title: 'Admin Approves', desc: 'The organisation authorises the achievement.', color: 'from-fuchsia-500 to-pink-500' },
  { icon: HardDrive, title: 'Archived', desc: 'Permanently stored in Google Drive and on-chain.', color: 'from-emerald-500 to-teal-500' },
  { icon: Link2, title: 'Verified', desc: 'Anyone can verify authenticity via a public link.', color: 'from-cyan-500 to-blue-500' },
];

export default function InteractiveDemo() {
  const [step, setStep] = useState(0);
  const isComplete = step === stages.length - 1;
  const current = stages[step];

  const next = () => setStep((s) => Math.min(s + 1, stages.length - 1));
  const reset = () => setStep(0);

  return (
    <section id="demo" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-slate-950 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-violet-400 uppercase tracking-widest mb-3">Interactive Demo</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
            See the verification lifecycle
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
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
              >
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    i <= step
                      ? 'bg-gradient-to-br ' + s.color + ' border-transparent scale-110 shadow-lg'
                      : 'bg-slate-900 border-white/15'
                  }`}
                >
                  {i < step ? (
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  ) : (
                    <s.icon className={`h-5 w-5 ${i <= step ? 'text-white' : 'text-slate-500'}`} />
                  )}
                </div>
                <span className={`text-[10px] sm:text-xs font-medium hidden sm:block ${i <= step ? 'text-white' : 'text-slate-500'}`}>
                  {s.title}
                </span>
              </button>
              {i < stages.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all duration-500 ${i < step ? 'bg-violet-500' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        {/* stage card */}
        <div className="relative max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              transition={{ duration: 0.35 }}
              className="relative p-10 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-md overflow-hidden"
            >
              <div className={`absolute -top-20 -right-20 h-48 w-48 rounded-full bg-gradient-to-br ${current.color} opacity-20 blur-3xl`} />
              <div className="relative text-center">
                <div className={`inline-flex h-16 w-16 rounded-2xl bg-gradient-to-br ${current.color} items-center justify-center mb-6 shadow-2xl`}>
                  <current.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">{current.title}</h3>
                <p className="text-slate-400 leading-relaxed max-w-md mx-auto">{current.desc}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* controls */}
        <div className="flex items-center justify-center gap-4 mt-8">
          {isComplete ? (
            <Button onClick={reset} variant="outline" className="border-white/15 text-white bg-white/5 hover:bg-white/10">
              <RotateCcw className="mr-2 h-4 w-4" />
              Restart Demo
            </Button>
          ) : (
            <Button onClick={next} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0">
              {step === 0 ? 'Start Demo' : 'Next Stage'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}