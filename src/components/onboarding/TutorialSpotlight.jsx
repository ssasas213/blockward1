import { useEffect, useState } from 'react';

/**
 * Spotlight: dims the rest of the screen and outlines the target with a
 * soft purple ring + glow. Uses the box-shadow cutout technique so the
 * highlighted element stays fully visible. Never fully blacks out the page.
 */
export default function TutorialSpotlight({ rect }) {
  const [shown, setShown] = useState(rect);

  useEffect(() => {
    // allow a tick for scroll-into-view to settle before locking rect
    const id = requestAnimationFrame(() => setShown(rect));
    return () => cancelAnimationFrame(id);
  }, [rect]);

  if (!shown) {
    return <div className="fixed inset-0 z-40 bg-black/45 pointer-events-none transition-opacity duration-300" />;
  }

  const pad = 8;
  const x = shown.x - pad, y = shown.y - pad, w = shown.w + pad * 2, h = shown.h + pad * 2;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div
        className="absolute transition-all duration-500 ease-out"
        style={{
          left: x, top: y, width: w, height: h,
          borderRadius: 16,
          boxShadow: '0 0 0 9999px rgba(8,7,13,0.6)',
        }}
      />
      <div
        className="absolute transition-all duration-500 ease-out"
        style={{
          left: x, top: y, width: w, height: h,
          borderRadius: 16,
          border: '2px solid hsl(258 90% 66% / 0.65)',
          boxShadow: '0 0 26px hsl(258 90% 66% / 0.35), inset 0 0 18px hsl(258 90% 66% / 0.12)',
        }}
      />
    </div>
  );
}