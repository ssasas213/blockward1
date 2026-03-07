import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Award, Bell, BookOpen, CheckCircle2, Sparkles, ChevronRight, GraduationCap, Star, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const teacherSteps = [
  {
    title: "Issue a BlockWard",
    description: "Mrs. Thompson selects a student — Sarah — and taps 'Issue BlockWard' for outstanding performance in Mathematics.",
    visual: (
      <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">MT</div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Mrs. Thompson</p>
            <p className="text-xs text-slate-500">Mathematics Teacher</p>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-xs text-slate-500 mb-2">Issuing BlockWard to</p>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">SJ</div>
            <p className="font-semibold text-slate-800 text-sm">Sarah Johnson — Year 11</p>
          </div>
          <div className="flex gap-2 flex-wrap mb-3">
            {["Academic", "Term 1", "Maths"].map(t => (
              <span key={t} className="text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-full">{t}</span>
            ))}
          </div>
          <button className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm py-2 rounded-xl font-semibold flex items-center justify-center gap-2">
            <Award className="h-4 w-4" /> Issue BlockWard
          </button>
        </div>
      </div>
    )
  },
  {
    title: "Send a Class Announcement",
    description: "She uses the AI assistant to draft and send an announcement to all of Year 11 about an upcoming exam — in seconds.",
    visual: (
      <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-violet-600" />
          <p className="font-semibold text-slate-900 text-sm">AI Announcement Assistant</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-3">
          <p className="text-xs text-slate-500 mb-1">Your topic</p>
          <p className="text-sm text-slate-800">"Remind Year 11 about the Maths exam next Tuesday"</p>
        </div>
        <div className="bg-violet-50 rounded-xl p-4 border border-violet-200">
          <p className="text-xs text-violet-600 font-medium mb-1">AI Draft ✨</p>
          <p className="text-sm text-slate-700">"Dear Year 11 students, this is a reminder that your Mathematics exam is on Tuesday, 11th March at 9:00 AM. Please review chapters 5–8..."</p>
        </div>
        <button className="w-full mt-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm py-2 rounded-xl font-semibold">
          Send to Year 11
        </button>
      </div>
    )
  },
  {
    title: "Track Class Performance",
    description: "The analytics dashboard shows her which students are thriving and who needs extra attention — all at a glance.",
    visual: (
      <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100">
        <p className="font-semibold text-slate-900 text-sm mb-4">Class Performance — Year 11 Maths</p>
        <div className="space-y-3">
          {[
            { name: "Sarah Johnson", points: 95, color: "bg-violet-500" },
            { name: "James Lee", points: 78, color: "bg-indigo-500" },
            { name: "Aisha Patel", points: 62, color: "bg-blue-400" },
            { name: "Tom Roberts", points: 41, color: "bg-orange-400" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">{s.name[0]}</div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <p className="text-xs font-medium text-slate-700">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.points}pts</p>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full">
                  <div className={`h-1.5 rounded-full ${s.color}`} style={{ width: `${s.points}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
];

const studentSteps = [
  {
    title: "Receive a BlockWard",
    description: "Sarah gets a notification — she's just been awarded a BlockWard for Outstanding Mathematics Achievement, permanently recorded on the blockchain.",
    visual: (
      <div className="space-y-3">
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3">
          <Bell className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-900 text-sm">New BlockWard Received! 🎉</p>
            <p className="text-xs text-slate-600 mt-1">Mrs. Thompson awarded you "Academic Excellence — Term 1"</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Shield className="h-8 w-8" />
            <div className="flex items-center gap-1.5 bg-green-500/20 border border-green-400/30 px-2 py-1 rounded-full">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-300 font-medium">Verified On-Chain</span>
            </div>
          </div>
          <p className="text-lg font-bold mb-1">Academic Excellence</p>
          <p className="text-white/70 text-sm">Term 1 · Mathematics · Year 11</p>
          <p className="text-xs text-white/50 mt-3 font-mono">0x7f3a...9c2b</p>
        </div>
      </div>
    )
  },
  {
    title: "View My Achievement Portfolio",
    description: "Sarah opens her portfolio to see all her BlockWards — a permanent, verified record she can share directly with universities.",
    visual: (
      <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-slate-900 text-sm">Sarah's BlockWards</p>
          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-full font-medium">6 Total</span>
        </div>
        <div className="space-y-2">
          {[
            { title: "Academic Excellence", cat: "Academic", icon: "🏆" },
            { title: "Team Leader Award", cat: "Leadership", icon: "⭐" },
            { title: "Science Fair Winner", cat: "Academic", icon: "🔬" },
          ].map((bw, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-xl">{bw.icon}</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">{bw.title}</p>
                <p className="text-xs text-slate-500">{bw.cat}</p>
              </div>
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
            </div>
          ))}
        </div>
        <button className="w-full mt-3 border-2 border-violet-200 text-violet-700 text-sm py-2 rounded-xl font-semibold bg-violet-50">
          Share with University
        </button>
      </div>
    )
  },
  {
    title: "Check Timetable & Announcements",
    description: "She checks her timetable for today's classes and reads the exam reminder from Mrs. Thompson — all in one app.",
    visual: (
      <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100">
        <p className="font-semibold text-slate-900 text-sm mb-4">Today — Tuesday</p>
        <div className="space-y-2 mb-4">
          {[
            { time: "09:00", subject: "Mathematics", room: "B12", color: "border-violet-400 bg-violet-50" },
            { time: "11:00", subject: "English Literature", room: "A3", color: "border-blue-400 bg-blue-50" },
            { time: "14:00", subject: "Physics", room: "Lab 2", color: "border-cyan-400 bg-cyan-50" },
          ].map((cls, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border-l-4 ${cls.color}`}>
              <p className="text-xs font-bold text-slate-500 w-10">{cls.time}</p>
              <div>
                <p className="text-sm font-semibold text-slate-800">{cls.subject}</p>
                <p className="text-xs text-slate-500">Room {cls.room}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-amber-700">📢 Announcement</p>
          <p className="text-xs text-slate-600 mt-1">Maths exam reminder — Tuesday 9:00 AM. Review chapters 5–8.</p>
        </div>
      </div>
    )
  }
];

export default function DemoModal({ onClose }) {
  const [activeRole, setActiveRole] = useState('teacher');
  const [currentStep, setCurrentStep] = useState(0);

  const steps = activeRole === 'teacher' ? teacherSteps : studentSteps;

  const handleRoleChange = (role) => {
    setActiveRole(role);
    setCurrentStep(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-violet-950 p-6 relative">
          <button onClick={onClose} className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-white" />
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-white">BlockWard AI — Live Demo</p>
              <p className="text-xs text-slate-400">See how it works for your school</p>
            </div>
          </div>

          {/* Role Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => handleRoleChange('teacher')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeRole === 'teacher' ? 'bg-white text-violet-700' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
            >
              <BookOpen className="h-4 w-4" /> Teacher View
            </button>
            <button
              onClick={() => handleRoleChange('student')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeRole === 'student' ? 'bg-white text-violet-700' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
            >
              <GraduationCap className="h-4 w-4" /> Student View
            </button>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex gap-2 px-6 pt-5">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${i <= currentStep ? 'bg-violet-600' : 'bg-slate-200'}`}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeRole}-${currentStep}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="mb-2 text-xs font-semibold text-violet-600 uppercase tracking-wider">
                Step {currentStep + 1} of {steps.length}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{steps[currentStep].title}</h3>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">{steps[currentStep].description}</p>
              {steps[currentStep].visual}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Nav */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            Back
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="bg-gradient-to-r from-violet-600 to-indigo-600"
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={onClose} className="bg-gradient-to-r from-violet-600 to-indigo-600">
              Get Started <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}