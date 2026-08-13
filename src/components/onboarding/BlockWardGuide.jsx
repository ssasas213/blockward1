import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useSchool } from '@/lib/SchoolContext';
import { isTourCompleted, completeTour } from '@/lib/tour';
import { getTour, findTarget } from './tourConfig';
import TutorialSpotlight from './TutorialSpotlight';
import TutorialDialogue from './TutorialDialogue';
import TutorialLifecycle from './TutorialLifecycle';
import TutorialVerifyCard from './TutorialVerifyCard';
import TutorialCredential from './TutorialCredential';
import MascotFallback from './MascotFallback';

const BlockWardMascot3D = lazy(() => import('./BlockWardMascot3D'));

const MASCOT_SIZE_DESKTOP = 180;
const MASCOT_SIZE_MOBILE = 120;

function computePlacement(step, isMobile) {
  let rect = null;
  let mascot = { left: '50%', top: '52%' };
  let dialogue = { left: '50%', bottom: '8%', top: 'auto', transform: 'translateX(-50%)' };

  if (isMobile) {
    mascot = { left: '50%', top: '22%' };
    dialogue = { left: '50%', bottom: '2rem', top: 'auto', transform: 'translateX(-50%)' };
  }

  if (step.target) {
    const el = findTarget(step.target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // rect measured after a tick in effect
  } else if (!isMobile) {
    if (step.mascotPos === 'center') {
      mascot = { left: '50%', top: '50%' };
      dialogue = { left: '50%', bottom: '8%', top: 'auto', transform: 'translateX(-50%)' };
    } else if (step.mascotPos === 'right') {
      mascot = { left: '76%', top: '44%' };
      dialogue = { left: '38%', top: '44%', transform: 'translate(-50%,-50%)' };
    } else if (step.mascotPos === 'left') {
      mascot = { left: '18%', top: '44%' };
      dialogue = { left: '32%', top: '44%', transform: 'translate(-50%,-50%)' };
    }
  }
  return { rect, mascot, dialogue };
}

export default function BlockWardGuide() {
  const { user, profile, loading } = useSchool();
  const navigate = useNavigate();

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [mascot3DError, setMascot3DError] = useState(false);
  const [placement, setPlacement] = useState({ rect: null, mascot: { left: '50%', top: '52%' }, dialogue: { left: '50%', bottom: '8%', top: 'auto', transform: 'translateX(-50%)' } });

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const use3D = !isMobile && !mascot3DError;
  const role = profile?.user_type || 'student';
  const steps = useMemo(() => getTour(role), [role]);
  const step = steps[index];
  const mascotSize = isMobile ? MASCOT_SIZE_MOBILE : MASCOT_SIZE_DESKTOP;

  // Auto-launch for first-time users
  useEffect(() => {
    if (loading || !user || !profile) return;
    if (isTourCompleted()) return;
    const t = setTimeout(() => setActive(true), 900);
    return () => clearTimeout(t);
  }, [loading, user, profile]);

  // Replay handler
  useEffect(() => {
    const onReplay = () => { setIndex(0); setActive(true); };
    window.addEventListener('bw-replay-tour', onReplay);
    return () => window.removeEventListener('bw-replay-tour', onReplay);
  }, []);

  // Compute placement on step change + resize
  useEffect(() => {
    if (!active) return;
    const apply = () => {
      const p = computePlacement(step, isMobile);
      let rect = p.rect;
      if (step.target) {
        const el = findTarget(step.target);
        if (el) {
          const r = el.getBoundingClientRect();
          rect = { x: r.left, y: r.top, w: r.width, h: r.height };
        }
      }
      setPlacement({ rect, mascot: p.mascot, dialogue: p.dialogue });
    };
    const id = requestAnimationFrame(apply);
    const onResize = () => apply();
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', onResize); };
  }, [active, index, step, isMobile]);

  if (!active || !step) return null;

  const finish = () => { completeTour(); setActive(false); };
  const start = () => setIndex(1);
  const next = () => {
    if (step.final) {
      completeTour();
      setActive(false);
      if (step.cta?.page) navigate(createPageUrl(step.cta.page));
      return;
    }
    setIndex(i => Math.min(i + 1, steps.length - 1));
  };
  const back = () => setIndex(i => Math.max(i - 1, 0));
  const skip = () => finish();

  const visual = step.visual === 'credential' ? <TutorialCredential /> :
    step.visual === 'lifecycle' ? <TutorialLifecycle /> :
    step.visual === 'verify' ? <TutorialVerifyCard /> : null;

  return (
    <div className="fixed inset-0 z-[100] font-sans" role="dialog" aria-label="BlockWard tour">
      <style>{`
        @keyframes bw-mascot-in { from{opacity:0;transform:translate(-50%,-50%) translateY(40px) rotate(-12deg) scale(0.85)} to{opacity:1;transform:translate(-50%,-50%) translateY(0) rotate(0) scale(1)} }
        @keyframes bw-mascot-move { from{opacity:0;transform:translate(-50%,-50%) translateY(14px) scale(0.96)} to{opacity:1;transform:translate(-50%,-50%) translateY(0) scale(1)} }
      `}</style>

      <TutorialSpotlight rect={placement.rect} />

      {/* Mascot */}
      <div
        className="fixed z-[102] pointer-events-none"
        style={{ left: placement.mascot.left, top: placement.mascot.top, transform: 'translate(-50%,-50%)', transition: 'left 500ms ease, top 500ms ease' }}
      >
        <div
          key={step.id}
          className="blockward-mascot-shell"
          style={{ animation: `${index === 0 ? 'bw-mascot-in' : 'bw-mascot-move'} 600ms cubic-bezier(0.22,1,0.36,1) both`, filter: 'drop-shadow(0 8px 26px rgba(139,92,246,0.35))' }}
        >
          <Suspense fallback={<MascotFallback size={mascotSize} />}>
            {use3D ? <BlockWardMascot3D size={mascotSize} onError={setMascot3DError} /> : <MascotFallback size={mascotSize} />}
          </Suspense>
        </div>
      </div>

      {/* Dialogue + visual */}
      <div
        className="fixed z-[103]"
        style={{ left: placement.dialogue.left, top: placement.dialogue.top, bottom: placement.dialogue.bottom, transform: placement.dialogue.transform, transition: 'left 500ms ease, top 500ms ease' }}
      >
        <div className="animate-fade-in flex flex-col items-stretch gap-3">
          {visual && <div className="flex justify-center pointer-events-none">{visual}</div>}
          <TutorialDialogue
            step={step}
            index={index}
            total={steps.length}
            onBack={back}
            onNext={next}
            onSkip={skip}
            onStart={start}
            ctaLabel={step.cta?.label}
            isFinal={step.final}
          />
        </div>
      </div>
    </div>
  );
}