import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PenLine, Type, RotateCcw, Check } from 'lucide-react';

export default function SignatureCapture({ signerName, onConfirm, disabled }) {
  const [tab, setTab] = useState('typed');
  const [typedName, setTypedName] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const canvasRef = useRef(null);
  const lastPos = useRef(null);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e) => {
    if (disabled) return;
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasDrawing(true);
  };

  const endDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  };

  const handleConfirm = () => {
    if (tab === 'typed') {
      if (!typedName.trim()) return;
      onConfirm({ type: 'typed', value: typedName.trim() });
    } else {
      if (!hasDrawing) return;
      const dataUrl = canvasRef.current.toDataURL('image/png');
      onConfirm({ type: 'drawn', value: dataUrl });
    }
  };

  const canConfirm = tab === 'typed' ? typedName.trim().length > 0 : hasDrawing;

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="typed" className="flex-1 gap-2">
            <Type className="h-4 w-4" /> Type Name
          </TabsTrigger>
          <TabsTrigger value="drawn" className="flex-1 gap-2">
            <PenLine className="h-4 w-4" /> Draw Signature
          </TabsTrigger>
        </TabsList>

        <TabsContent value="typed" className="space-y-3 pt-2">
          <p className="text-sm text-slate-500">
            Type your full legal name to sign this record as <strong>{signerName}</strong>.
          </p>
          <Input
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Type your full name..."
            disabled={disabled}
            className="text-lg font-medium"
            style={{ fontFamily: 'Georgia, serif' }}
          />
          {typedName && (
            <p className="text-xs text-slate-400 italic" style={{ fontFamily: 'Georgia, serif' }}>
              Preview: {typedName}
            </p>
          )}
        </TabsContent>

        <TabsContent value="drawn" className="space-y-3 pt-2">
          <p className="text-sm text-slate-500">Draw your signature in the box below.</p>
          <div className="relative border-2 border-dashed border-slate-300 rounded-lg overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              width={480}
              height={140}
              className="w-full touch-none cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            {!hasDrawing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-slate-300 text-sm">Sign here</p>
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={clearCanvas} disabled={!hasDrawing || disabled}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        </TabsContent>
      </Tabs>

      <Button
        onClick={handleConfirm}
        disabled={!canConfirm || disabled}
        className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
      >
        <Check className="h-4 w-4 mr-2" />
        Confirm &amp; Sign
      </Button>
    </div>
  );
}