import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Reveal from '@/components/home/Reveal';

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
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 30%, hsl(258 90% 66% / 0.09), transparent 65%)' }}
      />
      <div className="relative z-10 max-w-2xl mx-auto">
        <Reveal>
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white uppercase leading-[1.1]">
              Don't take their word for it. <span className="text-brand-gradient">Verify it.</span>
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
            <button
              type="submit"
              disabled={status === 'checking' || !value.trim()}
              className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-lg bg-brand-gradient text-white font-semibold text-sm transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:pointer-events-none"
            >
              {status === 'checking'
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Search className="h-4 w-4" />}
              Verify Credential
            </button>
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