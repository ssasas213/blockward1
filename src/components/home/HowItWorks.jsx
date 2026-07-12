import React from 'react';
import { FileText, Search, PenLine, ShieldCheck, HardDrive, Link2 } from 'lucide-react';

const steps = [
  { icon: FileText, title: 'Achievement Created', desc: 'A teacher, coach, instructor, or manager creates a record with supporting evidence.' },
  { icon: Search, title: 'Verification', desc: 'Evidence is reviewed and validated by the responsible verifier.' },
  { icon: PenLine, title: 'Digital Signatures', desc: 'Authorised individuals sign the record with their digital signature.' },
  { icon: ShieldCheck, title: 'Approval', desc: 'The organisation authorises the achievement, completing the trust chain.' },
  { icon: HardDrive, title: 'Permanent Archive', desc: 'Stored securely in Google Drive and on the BlockWard blockchain.' },
  { icon: Link2, title: 'Public Verification', desc: 'Universities, employers, and organisations can verify authenticity instantly.' },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-border">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm text-primary font-medium mb-2">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight mb-3">
            From achievement to permanent record
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            A six-stage verification lifecycle that turns any accomplishment into a trusted, verifiable credential.
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

          {steps.map((step, i) => (
            <div key={i} className="relative flex items-start gap-5 mb-6 last:mb-0">
              <div className="relative z-10 flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-card border border-border flex items-center justify-center">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div className="flex-1 p-5 rounded-xl bg-card/40 backdrop-blur-md border border-border">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-mono text-muted-foreground">0{i + 1}</span>
                  <h3 className="text-base font-medium text-foreground">{step.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}