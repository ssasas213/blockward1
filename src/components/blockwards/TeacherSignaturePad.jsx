import React, { useRef, useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { PenLine, Trash2, CheckCircle2, User, School, Clock } from 'lucide-react';

export default function TeacherSignaturePad({ profile, schoolName, onSignatureComplete }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [lastPos, setLastPos] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const pos = getPos(e, canvas);
    setIsDrawing(true);
    setLastPos(pos);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setLastPos(pos);
    setHasSignature(true);
  };

  const stopDrawing = (e) => {
    e?.preventDefault();
    setIsDrawing(false);
    setLastPos(null);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureComplete(null);
  };

  const confirmSignature = () => {
    if (!hasSignature) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onSignatureComplete(dataUrl);
  };

  const teacherName = profile ? `${profile.first_name} ${profile.last_name}` : 'Teacher';
  const teacherRole = profile?.department ? `${profile.department} Teacher` : 'Teacher';
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      {/* Signatory Info Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Signatory Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Teacher Name</p>
              <p className="text-sm font-semibold text-slate-900">{teacherName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <School className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Role / School</p>
              <p className="text-sm font-semibold text-slate-900">{teacherRole}</p>
              {schoolName && <p className="text-xs text-slate-400">{schoolName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Date & Time</p>
              <p className="text-sm font-semibold text-slate-900">{dateStr}</p>
              <p className="text-xs text-slate-400">{timeStr}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Pad */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Draw Your Signature *</p>
          {hasSignature && (
            <Button type="button" variant="ghost" size="sm" onClick={clearSignature}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1.5 h-8">
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
        <div className={`relative border-2 rounded-xl overflow-hidden transition-colors ${
          hasSignature ? 'border-violet-400 bg-white' : 'border-dashed border-slate-300 bg-slate-50'
        }`}>
          <canvas
            ref={canvasRef}
            width={800}
            height={200}
            className="w-full touch-none cursor-crosshair"
            style={{ height: '180px' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {!hasSignature && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <PenLine className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Sign here using your mouse or finger</p>
              </div>
            </div>
          )}
          {/* Signature line */}
          <div className="absolute bottom-8 left-8 right-8 border-b border-slate-300 pointer-events-none" />
          <p className="absolute bottom-2 left-8 text-xs text-slate-400 pointer-events-none">Signature</p>
        </div>
        <p className="text-xs text-slate-400">
          By signing, you confirm this achievement record is accurate and authentic. This signature will be permanently attached to the record.
        </p>
      </div>

      {/* Confirm button */}
      <Button
        type="button"
        onClick={confirmSignature}
        disabled={!hasSignature}
        className="w-full h-12 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg gap-2 disabled:opacity-40"
      >
        <CheckCircle2 className="h-5 w-5" />
        Confirm Signature & Continue
      </Button>
    </div>
  );
}