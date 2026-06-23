import React from 'react';
import { motion } from 'framer-motion';
import Wardy from './Wardy';

const tipsByRole = {
  student: 'Connect your Google Drive to auto-archive every approved achievement to your personal vault.',
  teacher: 'Submit achievements for approval \u2014 your digital signature starts the verification chain.',
  admin: 'Review the approval queue and authorise achievements to mint them permanently on-chain.',
};

export default function MascotGreeting({ name, role = 'student' }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const tip = tipsByRole[role] || tipsByRole.student;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-pink-200/60 bg-gradient-to-r from-pink-50 via-white to-violet-50 shadow-sm"
    >
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-pink-200/30 blur-2xl" />
      <div className="relative flex items-center gap-4 p-5">
        <div className="hidden sm:block flex-shrink-0">
          <Wardy size={64} floating withParticles={false} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900">
            {greeting}, {name || 'there'}!
          </h2>
          <p className="text-sm text-slate-600 mt-1">{tip}</p>
        </div>
      </div>
    </motion.div>
  );
}