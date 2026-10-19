import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Reveal from '@/components/home/Reveal';
import GlowActionButton from '@/components/ui/GlowActionButton';

export default function VerifyWidget() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('idle'); // idle | checking | notfound
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const raw = value.trim().toUpperCase().replace(/\s+/g, '');
    if (!raw) return;
    const bwId = raw.startsWith('BW-') ? raw : `BW-${raw}`;
    setStatus('checking');
    setError('');
    try {
      const res = await base44.functions.invoke('publicVerifyData', { bw_id: bwId });
      if (res.data?.found) {
        navigate(`/verify/${res.data.credential.bw_id}`);
      } else {
        setStatus('notfound');
      }
    } catch {
      setStatus('notfound');
    }
  };

  return (
    <section id="verify" className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-t border-border overflow-hidden scroll-mt-16">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 30%, hsl(217 84% 53% / 0.08), transparent 65%)' }}
      />
      <div className="relative z-10 max-w-2xl mx-auto">
        <Reveal>
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl sm:text-5xl tracking-tight text-white leading-[1.15]">
              Don't take their word for it.
            </h2>
            <p className="text-base text-muted-foreground mt-5 leading-relaxed">
              Enter a Blockward Credential ID to independently check its issuer, verification and
              integrity status.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={value}
              onChange={(e) => { setValue(e.target.value); setStatus('idle'); }}
              placeholder="BW-XXXXXXXX"
              aria-label="Blockward Credential ID"
              className="flex-1 h-12 px-4 rounded-lg bg-secondary/60 border border-border text-white placeholder:text-tertiary font-mono tracking-wide focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors"
            />
            <GlowActionButton
              type="submit"
              size="md"
              icon={Search}
              label="Verify Credential"
              loading={status === 'checking'}
              disabled={!value.trim()}
              className="shrink-0"
            />
          </form>

          {status === 'notfound' && (
            <p className="mt-4 text-sm text-warning text-center">
              No credential found with that ID. Check the ID and try again.
            </p>
          )}

          <p className="mt-5 text-center text-sm text-tertiary">No Blockward account required.</p>
          <p className="mt-2 text-center text-xs text-tertiary">
            Try a real example:{' '}
            <button
              type="button"
              onClick={() => { setValue('BW-RBHWAXJZ'); setStatus('idle'); }}
              className="font-mono text-brand-violet hover:underline"
            >
              BW-RBHWAXJZ
            </button>
          </p>
        </Reveal>
      </div>
    </section>
  );
}