import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import Wardy from './Wardy';
import { Sparkles, Award, ShieldCheck, FolderArchive, PenLine, HardDrive, Link2, ArrowRight, ArrowLeft, X } from 'lucide-react';

const screens = [
  { icon: Sparkles, title: 'What is BlockWard?', desc: 'BlockWard is the world\u2019s digital custodian for verified achievements \u2014 a permanent, tamper-proof home for every accomplishment.' },
  { icon: Award, title: 'How achievements work', desc: 'Teachers, coaches, and managers create achievement records with supporting evidence, ready for verification.' },
  { icon: ShieldCheck, title: 'How verification works', desc: 'Records move through a verification lifecycle: review, digital signatures, and organisational approval.' },
  { icon: FolderArchive, title: 'Portfolio Vault', desc: 'Every verified achievement builds a permanent, portable portfolio that travels with you for life.' },
  { icon: PenLine, title: 'Digital Signatures', desc: 'Authorised individuals sign records with legally-binding digital signatures, creating a full audit trail.' },
  { icon: HardDrive, title: 'Google Drive Archive', desc: 'Verified records are archived permanently to your own Google Drive \u2014 you own your credentials.' },
  { icon: Link2, title: 'NFT Verification', desc: 'Achievements are minted as NFTs on the blockchain, verifiable by universities, employers, and anyone via a public link.' },
];

export default function OnboardingTour({ profile, onComplete }) {
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const total = screens.length;
  const current = screens[step];

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      if (profile?.id) {
        await base44.entities.UserProfile.update(profile.id, { onboarding_completed: true });
      }
    } catch (e) { /* ignore */ }
    onComplete?.();
  };

  const next = () => (step < total - 1 ? setStep(step + 1) : finish());
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="relative w-full max-w-lg rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 shadow-2xl overflow-hidden"
      >
        <button onClick={finish} className="absolute top-4 right-4 z-10 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
          <X className="h-5 w-5" />
        </button>

        <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-pink-500 to-violet-500"
            initial={{ width: 0 }}
            animate={{ width: `${((step + 1) / total) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="p-8 sm:p-10 text-center">
          <div className="flex justify-center mb-6">
            <Wardy size={110} />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <div className="inline-flex h-12 w-12 rounded-xl bg-gradient-to-br from-pink-500/20 to-violet-500/20 border border-pink-500/30 items-center justify-center mb-4">
                <current.icon className="h-6 w-6 text-pink-300" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">{current.title}</h2>
              <p className="text-slate-400 leading-relaxed max-w-sm mx-auto">{current.desc}</p>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-center gap-2 my-8">
            {screens.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-pink-400' : 'w-2 bg-white/20 hover:bg-white/40'}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={back} disabled={step === 0} className="text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
            <button onClick={finish} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
              Skip Tour
            </button>
            <Button onClick={next} disabled={finishing} className="bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 border-0">
              {step === total - 1 ? 'Get Started' : 'Next'}
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}