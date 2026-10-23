import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import BlockTalksIntro from '@/components/blocktalks/BlockTalksIntro';
import BlockTalksApp from '@/components/blocktalks/BlockTalksApp';
import { Loader2 } from 'lucide-react';

// /BlockTalks — BlockWard's professional achievement-sharing platform.
// Logged-in users land straight on the feed; logged-out visitors get the
// introduction (whose sign-in / sign-up buttons return here). One shared
// BlockWard account — no separate BlockTalks authentication.
export default function BlockTalks() {
  const [state, setState] = useState('loading'); // loading | guest | app
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await base44.auth.me();
        if (!cancelled) { setUser(me); setState(me ? 'app' : 'guest'); }
      } catch {
        if (!cancelled) setState('guest'); // anonymous visitor
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0F1A]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return state === 'app' ? <BlockTalksApp user={user} /> : <BlockTalksIntro />;
}