import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Award, BookOpen, Bell, CheckCircle2, ChevronRight, GraduationCap, Star, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

const teacherSteps = [
  {
    icon: BookOpen,
    title: "Teacher creates a class",
    description: "Mrs. Ahmed sets up 'Year 10 Mathematics' and adds students with a simple join code.",
    visual: (
      <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Year 10 Mathematics</p>
            <p className="text-xs text-slate-500">Join Code: <span className="font-mono font-bold text-violet-600">MATH10</span></p>
          </div>
        </div>
        <div className="space-y-2">
          {["Sarah Johnson", "James Okafor", "Layla Hassan"].map((s, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">{s[0]}</div>
              <span className="text-sm text-slate-700">{s}</span>
              <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    )
  },
  {
    icon: Award,
    title: "Teacher issues a BlockWard",
    description: "Sarah aces her algebra test. Mrs. Ahmed taps 'Issue BlockWard' and selects Academic Excellence.",
    visual: (
      <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-5 text-white shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            <span className="font-bold">BlockWard</span>
          </div>
          <div className="flex items-center gap-1.5 bg-green-500/30 border border-green-400/40 px-2.5 py-1 rounded-full">
            <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-300 font-medium">Minting...</span>
          </div>
        </div>
        <p className="text-sm text-white/60 mb-1">Awarded to</p>
        <p className="text-xl font-bold mb-1">Sarah Johnson</p>
        <p className="text-sm text-white/70 mb-4">Academic Excellence · Algebra Test</p>
        <div className="bg-white/10 rounded-xl p-3 font-mono text-xs text-white/60">
          Recording on Ethereum Sepolia...
        </div>
      </div>
    )
  },
  {
    icon: Bell,
    title: "Student gets notified instantly",
    description: "Sarah receives a notification — her BlockWard is live on the blockchain and added to her portfolio.",
    visual: (
      <div className="space-y-3">
        <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100 flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
            <Bell className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">New BlockWard Received! 🎉</p>
            <p className="text-xs text-slate-500 mt-0.5">Academic Excellence from Mrs. Ahmed</p>
            <p className="text-xs text-violet-600 mt-1 font-medium">View on blockchain →</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-lg border border-slate-100">
          <p className="text-xs text-slate-500 mb-2 font-medium">Sarah's Portfolio</p>
          <div className="flex gap-2">
            {["Academic", "Sports", "Leadership"].map((tag, i) => (
              <div key={i} className={`px-3 py-1.5 rounded-full text-xs font-medium ${i === 0 ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
                {tag} {i === 0 && '✓'}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
];

const studentSteps = [
  {
    icon: GraduationCap,
    title: "Student logs in & joins class",
    description: "James opens BlockWard AI, enters his school code and class join code to instantly join Year 10 Maths.",
    visual: (
      <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">J</div>
          <div>
            <p className="font-semibold text-slate-900">James Okafor</p>
            <p className="text-xs text-slate-500">Year 10 · Student</p>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { label: "My Classes", value: "3 active" },
            { label: "BlockWards", value: "2 earned" },
            { label: "Points", value: "+85 this term" },
          ].map((item, i) => (
            <div key={i} className="flex justify-between items-center px-3 py-2.5 rounded-xl bg-blue-50">
              <span className="text-sm text-slate-600">{item.label}</span>
              <span className="text-sm font-semibold text-blue-700">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  },
  {
    icon: Star,
    title: "Student earns a BlockWard",
    description: "James shows leadership during a group project. His teacher awards him a Leadership BlockWard — permanently recorded on-chain.",
    visual: (
      <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl p-5 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <Star className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold text-lg">Leadership Award</p>
            <p className="text-white/70 text-sm">Group Project Excellence</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white/10 rounded-xl p-3 mb-3">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <span className="text-sm text-white/80">Confirmed on Ethereum · Block #19,284,731</span>
        </div>
        <p className="text-xs text-white/50 font-mono">0x4f7c...3a9e</p>
      </div>
    )
  },
  {
    icon: Sparkles,
    title: "Student builds university portfolio",
    description: "James's BlockWards are stored permanently on-chain — a verified achievement record he shares directly with universities.",
    visual: (
      <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100">
        <p className="text-sm font-semibold text-slate-900 mb-4">James's Achievement Portfolio</p>
        <div className="space-y-3">
          {[
            { title: "Leadership Award", cat: "Leadership", color: "from-blue-500 to-cyan-500", verified: true },
            { title: "Top Scorer", cat: "Academic", color: "from-violet-500 to-indigo-500", verified: true },
            { title: "Team Player", cat: "Community", color: "from-green-500 to-teal-500", verified: false },
          ].map((bw, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${bw.color} flex items-center justify-center flex-shrink-0`}>
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{bw.title}</p>
                <p className="text-xs text-slate-500">{bw.cat}</p>
              </div>
              {bw.verified ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">On-Chain ✓</span>
              ) : (
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Pending</span>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }
];

export default function DemoModal({ open, onClose }) {
  const [activeRole, setActiveRole] = useState('teacher');
  const [activeStep, setActiveStep] = useState(0);

  const steps = activeRole === 'teacher' ? teacherSteps : studentSteps;
  const currentStep = steps[activeStep];

  const handleRoleChange = (role) => {
    setActiveRole(role);
    setActiveStep(0);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-5 flex items-center justify-between rounded-t-3xl z-10">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Live Demo</h2>
              <p className="text-sm text-slate-500">See how BlockWard AI works step by step</p>
            </div>
            <button onClick={onClose} className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
              <X className="h-5 w-5 text-slate-600" />
            </button>
          </div>

          {/* Role Toggle */}
          <div className="px-6 pt-6">
            <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
              {[
                { key: 'teacher', label: '👩‍🏫 Teacher View' },
                { key: 'student', label: '🎓 Student View' },
              ].map(role => (
                <button
                  key={role.key}
                  onClick={() => handleRoleChange(role.key)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${activeRole === role.key ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step Progress */}
          <div className="px-6 pt-5">
            <div className="flex items-center gap-2">
              {steps.map((_, i) => (
                <React.Fragment key={i}>
                  <button
                    onClick={() => setActiveStep(i)}
                    className={`h-2.5 rounded-full transition-all duration-300 ${i === activeStep ? 'bg-violet-600 w-8' : i < activeStep ? 'bg-violet-300 w-2.5' : 'bg-slate-200 w-2.5'}`}
                  />
                  {i < steps.length - 1 && <div className="flex-1 h-0.5 bg-slate-100" />}
                </React.Fragment>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">Step {activeStep + 1} of {steps.length}</p>
          </div>

          {/* Step Content */}
          <div className="px-6 py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeRole}-${activeStep}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center">
                    <currentStep.icon className="h-5 w-5 text-violet-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{currentStep.title}</h3>
                </div>
                <p className="text-slate-600 mb-6 leading-relaxed">{currentStep.description}</p>
                {currentStep.visual}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="px-6 pb-6 flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
              disabled={activeStep === 0}
              className="flex-1"
            >
              Previous
            </Button>
            {activeStep < steps.length - 1 ? (
              <Button
                onClick={() => setActiveStep(activeStep + 1)}
                className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600"
              >
                Next Step <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={onClose} className="flex-1 bg-gradient-to-r from-green-500 to-teal-500">
                Got it! ✓
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}