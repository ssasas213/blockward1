import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import DemoCertificate from './DemoCertificate';
import { ArrowRight, ShieldCheck, PenTool, Link2, FileText, BadgeCheck } from 'lucide-react';

/**
 * CertificateTransformation — homepage product demonstration. Shows the
 * journey from an ordinary certificate (evidence) to a Blockward Verified
 * credential (issuer + verifier signature + blockchain integrity).
 *
 * Communicates: "Your certificate is the evidence. Blockward makes it
 * verifiable." A restrained, user-triggered toggle between the two states —
 * no autoplay, no heavy animation.
 */
export default function CertificateTransformation() {
  const [verified, setVerified] = useState(false);

  return (
    <section className="relative py-20 lg:py-28 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Headline */}
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-3">
            From certificate to verified credential
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight leading-tight">
            Your certificate is the evidence.<br />
            <span className="text-brand-gradient">Blockward makes it verifiable.</span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
            Uploading a certificate is not verification. Blockward connects that evidence to the
            issuing organisation, an authorised verifier's signature, and a blockchain integrity
            record — creating a credential anyone can independently verify.
          </p>
        </div>

        {/* The transformation */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-8 lg:gap-6">
          {/* Evidence — always visible, dims when verified */}
          <div className={cn('transition-all duration-500', verified && 'opacity-40 grayscale')}>
            <div className="text-center mb-3">
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-tertiary">Original evidence</p>
              <p className="text-xs text-muted-foreground">What the holder uploads</p>
            </div>
            <DemoCertificate variant="original" />
          </div>

          {/* Arrow + verification steps */}
          <div className="flex lg:flex-col items-center justify-center gap-3 py-2">
            <div className="hidden lg:block text-center space-y-3">
              <VerificationStep icon={ShieldCheck} label="Issuer verified" tone="info" active={verified} />
              <VerificationStep icon={PenTool} label="Authorised verifier signed" tone="info" active={verified} />
              <VerificationStep icon={Link2} label="Integrity secured" tone="info" active={verified} />
            </div>
            <div className="lg:hidden flex items-center gap-1.5 text-tertiary">
              <ShieldCheck className="h-4 w-4" />
              <PenTool className="h-4 w-4" />
              <Link2 className="h-4 w-4" />
            </div>
            <div className="hidden lg:flex flex-col items-center text-primary mt-1">
              <ArrowRight className="h-5 w-5 rotate-90" />
            </div>
          </div>

          {/* Verified credential */}
          <div className={cn('transition-all duration-500', !verified && 'opacity-30 grayscale')}>
            <div className="text-center mb-3">
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-primary flex items-center justify-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5" /> Blockward verified
              </p>
              <p className="text-xs text-muted-foreground">The verifiable credential</p>
            </div>
            <DemoCertificate variant="verified" className="verified-glow" />
            {verified && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs">
                <Pill icon={ShieldCheck} label="Issuer ✓" />
                <Pill icon={PenTool} label="Signature ✓" />
                <Pill icon={Link2} label="Integrity ✓" />
              </div>
            )}
          </div>
        </div>

        {/* Toggle */}
        <div className="flex flex-col items-center mt-12 gap-3">
          <Button
            variant={verified ? 'outline' : 'default'}
            onClick={() => setVerified((v) => !v)}
            className="min-w-[200px]"
          >
            {verified ? 'Show original certificate' : 'Verify this credential'}
            <ArrowRight className={cn('h-4 w-4 ml-2 transition-transform', verified && 'rotate-180')} />
          </Button>
          <p className="text-xs text-tertiary max-w-md text-center">
            A certificate proves what you did. Blockward proves it's authentic — anchored on Polygon,
            independently verifiable by anyone, forever.
          </p>
        </div>
      </div>
    </section>
  );
}

function VerificationStep({ icon: Icon, label, active }) {
  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
      active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-tertiary')}>
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      {label}
    </div>
  );
}

function Pill({ icon: Icon, label }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 border border-success/30 px-2 py-0.5 text-success font-medium">
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}