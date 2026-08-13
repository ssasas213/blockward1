/**
 * Lightweight CSS/SVG mascot fallback — used on mobile, low-power devices,
 * or if the WebGL mascot fails. Same float + crystal identity.
 */
export default function MascotFallback({ size = 140 }) {
  return (
    <div className="relative" style={{ width: size, height: size }} aria-hidden="true">
      <style>{`
        @keyframes bw-mascot-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .bw-fallback-crystal{ animation: bw-mascot-float 3.2s ease-in-out infinite; }
      `}</style>
      <div className="bw-fallback-crystal absolute inset-0 flex items-center justify-center">
        <div
          className="relative"
          style={{
            width: size * 0.66,
            height: size * 0.82,
            transform: 'rotate(45deg)',
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(139,92,246,0.85), rgba(167,139,250,0.7), rgba(236,72,153,0.8))',
            border: '1px solid rgba(255,255,255,0.25)',
            boxShadow: '0 0 30px rgba(139,92,246,0.45), inset 0 0 24px rgba(236,72,153,0.35), inset 0 1px 0 rgba(255,255,255,0.4)',
            backdropFilter: 'blur(2px)',
          }}
        >
          {/* facet lines */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(135deg, transparent 49%, rgba(255,255,255,0.18) 50%, transparent 51%), linear-gradient(45deg, transparent 49%, rgba(255,255,255,0.12) 50%, transparent 51%)',
          }} />
        </div>
        {/* eyes — counter-rotate to face viewer */}
        <div className="absolute" style={{ left: '50%', top: '46%', transform: 'translate(-50%,-50%)' }}>
          <div className="flex gap-3">
            <span className="block rounded-full bg-[#160F24]" style={{ width: 8, height: 8 }} />
            <span className="block rounded-full bg-[#160F24]" style={{ width: 8, height: 8 }} />
          </div>
        </div>
      </div>
    </div>
  );
}