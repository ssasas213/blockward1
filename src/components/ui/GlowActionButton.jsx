import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// GlowActionButton — BlockWard's signature glowing blue pill: dark navy
// gradient body, luminous blue border and glow, circular icon on the left,
// thin vertical divider, centred action text (optional subtitle) and a
// bright blue circular arrow on the right. Styles live in src/index.css
// (.gbtn-*). Sizes: xs (table actions), sm (inline/dashboard), md
// (dashboards/forms), lg (homepage CTAs).
const SIZES = {
  xs: { pill: 'h-8 gap-1.5 pl-1 pr-1 text-[11px]', icon: 'h-6 w-6', iconInner: 'h-3 w-3', divider: 'my-2', arrowBox: 'h-6 w-6', arrowInner: 'h-3 w-3', label: '', sub: null },
  sm: { pill: 'h-10 gap-2 pl-1.5 pr-1.5', icon: 'h-7 w-7', iconInner: 'h-3.5 w-3.5', divider: 'my-2.5', arrowBox: 'h-7 w-7', arrowInner: 'h-3.5 w-3.5', label: 'text-[13px]', sub: 'text-[10px]' },
  md: { pill: 'h-12 gap-2.5 pl-2 pr-2', icon: 'h-9 w-9', iconInner: 'h-4 w-4', divider: 'my-3', arrowBox: 'h-9 w-9', arrowInner: 'h-4 w-4', label: 'text-sm', sub: 'text-[11px]' },
  lg: { pill: 'h-14 gap-3 pl-2.5 pr-2.5', icon: 'h-10 w-10', iconInner: 'h-[18px] w-[18px]', divider: 'my-4', arrowBox: 'h-10 w-10', arrowInner: 'h-[18px] w-[18px]', label: 'text-base', sub: 'text-xs' },
};

export default function GlowActionButton({
  icon: Icon,
  label,
  subtitle,
  size = 'md',
  variant = 'primary', // 'primary' = signature glow · 'secondary' = restrained blue outline
  onClick,
  to,
  href,
  type = 'button',
  loading = false,
  disabled = false,
  arrow = true,
  title,
  target,
  className = '',
  children,
}) {
  const navigate = useNavigate();
  const s = SIZES[size] || SIZES.md;
  const isDisabled = disabled || loading;

  const handleClick = (e) => {
    if (isDisabled) { e.preventDefault(); return; }
    if (to) { e.preventDefault(); navigate(to); return; }
    onClick?.(e);
  };

  const content = (
    <>
      {Icon && (
        <span className={cn('gbtn-icon', s.icon)}>
          <Icon className={s.iconInner} aria-hidden="true" />
        </span>
      )}
      {Icon && <span className={cn('gbtn-divider', s.divider)} />}
      <span className="flex flex-1 flex-col min-w-0 items-center justify-center px-2 text-center leading-tight">
        <span className={cn('gbtn-label block font-semibold whitespace-nowrap', s.label)}>{children || label}</span>
        {subtitle && s.sub && <span className={cn('gbtn-sub block', s.sub)}>{subtitle}</span>}
      </span>
      {loading ? (
        <span className={cn('gbtn-arrow', s.arrowBox)}><Loader2 className={cn(s.arrowInner, 'animate-spin')} /></span>
      ) : arrow ? (
        <span className={cn('gbtn-arrow', s.arrowBox)}><ArrowRight className={s.arrowInner} /></span>
      ) : null}
    </>
  );

  const classes = cn('gbtn', variant === 'secondary' && 'gbtn-secondary', s.pill, className);

  if (href) {
    return <a href={href} target={target} rel={target === '_blank' ? 'noopener noreferrer' : undefined} onClick={handleClick} title={title} aria-disabled={isDisabled || undefined} className={classes}>{content}</a>;
  }
  return (
    <button type={type} onClick={handleClick} disabled={isDisabled} title={title} className={classes}>
      {content}
    </button>
  );
}