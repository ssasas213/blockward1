import React, { useEffect, useRef, useState } from 'react';

// HeroFilm — the BlockWard story as a full-screen background film:
//   trophy → credential (6s) → blockchain anchor (6s) → vault → employer
//   verification (6s) ≈ 18s, muted, looping, with crossfades between clips.
// Pauses off-screen, poster until the first frame plays, and a static poster
// fallback under prefers-reduced-motion.

const CLIPS = [
  'https://media.base44.com/videos/public/6936b840baa53bb465f68d09/151da46c3_Trophy_to_Credential.mp4',
  'https://media.base44.com/videos/public/6936b840baa53bb465f68d09/0d161f111_Blockchain_Anchor.mp4',
  'https://media.base44.com/videos/public/6936b840baa53bb465f68d09/c7246cb24_Vault_to_Verification.mp4',
];
const POSTER =
  'https://media.base44.com/images/public/6936b840baa53bb465f68d09/9574546b0_generated_image.png';

export default function HeroFilm() {
  const videoRefs = useRef([]);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [started, setStarted] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Autoplay once on mount; track whether the hero is on screen so the film
  // pauses (and stops burning bandwidth/CPU) when scrolled past.
  useEffect(() => {
    if (reduced) return;
    videoRefs.current[0]?.play().catch(() => {});
    const el = videoRefs.current[0]?.closest('section');
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => setVisible(entries[0].isIntersecting),
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduced]);

  // Play/pause sync per phase + visibility.
  useEffect(() => {
    if (reduced) return;
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (visible && i === phaseIdx) {
        if (v.paused) v.play().catch(() => {});
      } else if (!v.paused) {
        v.pause();
      }
    });
  }, [visible, phaseIdx, reduced]);

  const advance = () => {
    const next = (phaseIdx + 1) % CLIPS.length;
    const nv = videoRefs.current[next];
    if (nv) nv.currentTime = 0;
    setPhaseIdx(next);
  };

  if (reduced) {
    return <img src={POSTER} alt="" className="absolute inset-0 h-full w-full object-cover" />;
  }

  return (
    <div className="absolute inset-0" aria-hidden="true">
      {CLIPS.map((src, i) => (
        <video
          key={src}
          ref={(el) => (videoRefs.current[i] = el)}
          src={src}
          poster={i === 0 ? POSTER : undefined}
          muted
          playsInline
          preload="auto"
          onEnded={advance}
          onPlaying={() => i === 0 && setStarted(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === phaseIdx ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
      {!started && <img src={POSTER} alt="" className="absolute inset-0 h-full w-full object-cover" />}
    </div>
  );
}