import React from 'react';
import { Shield } from 'lucide-react';

export default function SiteFooter() {
  return (
    <footer className="relative py-16 px-4 sm:px-6 lg:px-8 bg-black border-t border-white/10">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg text-white">BlockWard</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
              The world's digital custodian for verified achievements.
            </p>
          </div>

          {[
            { title: 'Platform', links: ['How it works', 'Features', 'Industries', 'Interactive Demo'] },
            { title: 'Company', links: ['About', 'Careers', 'Press', 'Contact'] },
            { title: 'Resources', links: ['Documentation', 'Verification', 'Security', 'Status'] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white mb-4">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#top" className="text-sm text-slate-500 hover:text-white transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">© 2026 BlockWard. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="#top" className="hover:text-white transition-colors">Privacy</a>
            <a href="#top" className="hover:text-white transition-colors">Terms</a>
            <a href="#top" className="hover:text-white transition-colors">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}