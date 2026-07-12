import React from 'react';
import { Shield } from 'lucide-react';

export default function SiteFooter() {
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-black border-t border-white/10">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-5 w-5 text-white" />
              <span className="font-semibold text-white">BlockWard</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
              The digital custodian for verified achievements.
            </p>
          </div>

          {[
            { title: 'Platform', links: ['How it works', 'Features', 'Industries', 'Demo'] },
            { title: 'Company', links: ['About', 'Careers', 'Press', 'Contact'] },
            { title: 'Resources', links: ['Documentation', 'Verification', 'Security', 'Status'] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-medium text-white mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#top" className="text-sm text-slate-500 hover:text-white transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-slate-500">© 2026 BlockWard. All rights reserved.</p>
          <div className="flex items-center gap-5 text-sm text-slate-500">
            <a href="#top" className="hover:text-white transition-colors">Privacy</a>
            <a href="#top" className="hover:text-white transition-colors">Terms</a>
            <a href="#top" className="hover:text-white transition-colors">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}