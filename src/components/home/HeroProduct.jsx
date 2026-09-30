import React from 'react';
import VerificationProgression from './VerificationProgression';
import HeroCredential from './HeroCredential';

/**
 * Hero product visual — the verification progression flowing into the
 * Blockward Verified credential. The progression sits directly above the
 * credential so they read as one connected product story rather than two
 * unrelated sections.
 */
export default function HeroProduct() {
  return (
    <div className="relative mt-12 flex w-full flex-col items-center gap-7">
      <VerificationProgression />
      <HeroCredential />
    </div>
  );
}