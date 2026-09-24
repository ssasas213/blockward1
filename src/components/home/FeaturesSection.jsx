import React from 'react';
import {
  ShieldCheck, PenLine, FileText, HardDrive, Award, Lock,
  Link2, History, Building2, FolderArchive, MessageSquare, Users,
} from 'lucide-react';

const features = [
  { icon: ShieldCheck, title: 'Digital Custodian System', desc: 'A secure, role-based custody model for every credential.' },
  { icon: PenLine, title: 'Digital Signatures', desc: 'Typed or drawn signatures with full signer attribution and an audit trail.' },
  { icon: FileText, title: 'Evidence Management', desc: 'Upload, attach, and review supporting evidence for each record.' },
  { icon: Award, title: 'Verified Credentials', desc: 'Achievements verified by named signers and anchored on a public ledger — corrections are visible, never silent.' },
  { icon: Lock, title: 'Tamper-evident verification', desc: 'Any change to a verified record breaks its on-chain fingerprint — tampering is detectable, not just promised against.' },
  { icon: Link2, title: 'Public Verification Links', desc: 'Shareable links for instant third-party verification.' },
  { icon: History, title: 'Audit Trails', desc: 'A complete, timestamped history of every action taken.' },
  { icon: Building2, title: 'School Management', desc: 'Classes, timetables, attendance, and gradebook tools.' },
  { icon: FolderArchive, title: 'Achievement Portfolios', desc: 'Portable, verified portfolios that travel with participants.' },
  { icon: MessageSquare, title: 'Parent Communication', desc: 'Secure messaging and announcements to parents.' },
  { icon: Users, title: 'Organisation Management', desc: 'Members, roles, permissions, and onboarding controls.' },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm text-primary font-medium mb-2">Features</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight mb-3">
            One platform. Zero compromise.
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            From verified credentials to complete organisation tools — everything a modern school or club needs.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <div
              key={i}
              className="card-hover p-5 rounded-xl bg-card border border-border"
            >
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-medium text-foreground mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}