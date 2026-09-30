import React from 'react';
import { cn } from '@/lib/utils';
import { BlockwardMark } from './BlockwardLogo';

/**
 * Blockward Verified mark — a small, proprietary product element that pairs
 * the Blockward badge with the words "BLOCKWARD VERIFIED". Intentionally NOT
 * a pill: it is mark + tight uppercase type so it reads as a stamp of trust,
 * reusable across credential cards, profiles and public verification pages.
 *
 * size: sm | md | lg
 */
const TEXT = {
  sm: 'text-[10px] tracking-[0.18em]',
  md: 'text-[11px] tracking-[0.18em]',
  lg: 'text-[13px] tracking-[0.16em]',
};

export function BlockwardVerifiedMark({ size = 'md', className }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <BlockwardMark size={size} />
      <span className={cn('font-semibold uppercase leading-none text-white', TEXT[size])}>
        Blockward <span className="text-[#93C5FD]">Verified</span>
      </span>
    </span>
  );
}

export default BlockwardVerifiedMark;