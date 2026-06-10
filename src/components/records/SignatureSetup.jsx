/**
 * SignatureSetup — First-time signature profile creation for teachers and admins.
 * Shown as a blocking modal before their first approval action.
 * Once saved, it is reused for all future approvals (snapshotted per record).
 */
import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PenLine, Type, RotateCcw, Shield, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function SignatureSetup({ profile, userEmail, onComplete }) {
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('typed');
  const [displayName, setDisplayName] = useState(`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim());
  const [title, setTitle] = useState('');
  const [typedSig, setTypedSig] = useState('');
  const [hasDrawing, setHasDrawing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const lastPos = useRef(null);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e) => { e.preventDefault(); setIsDrawing(true); lastPos.current = getPos(e, canvasRef.current); };
  const draw = (e) => {
    if (!isDrawing) return; e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    lastPos.current = pos; setHasDrawing(true);
  };
  const endDraw = () => setIsDrawing(false);
  const clearCanvas = () => { canvasRef.current.getContext('2d').clearRect(0, 0, 480, 160); setHasDrawing(false); };

  const canSave = displayName.trim() && title.trim() && (tab === 'typed' ? typedSig.trim() : hasDrawing);

  const handleSave = async () => {
    if (!canSave) { toast.error('Please fill in all fields and provide your signature'); return; }
    setSaving(true);
    try {
      const sigValue = tab === 'typed' ? typedSig.trim() : canvasRef.current.toDataURL('image/png');
      const sigProfile = await base44.entities.SignatureProfile.create({
        user_email: userEmail,
        school_id: profile.school_id,
        user_role: profile.user_type,
        display_name: displayName.trim(),
        title: title.trim(),
        signature_type: tab,
        signature_value: sigValue,
        created_at: new Date().toISOString()
      });
      toast.success('Signature profile created! You can now sign records.');
      onComplete(sigProfile);
    } catch (e) {
      toast.error('Failed to save signature: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-violet-600" />
            Create Your Digital Signature Profile
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="p-3 bg-violet-50 border border-violet-100 rounded-xl text-sm text-violet-800">
            <strong>First-time setup required.</strong> Your signature will be reused for all future approvals. It will be snapshotted on each record and cannot be altered after signing.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Full Legal Name *</Label>
              <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Dr. Sarah Johnson" />
            </div>
            <div className="space-y-1.5">
              <Label>{profile?.user_type === 'admin' ? 'Admin Title *' : 'Position / Title *'}</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={profile?.user_type === 'admin' ? 'e.g. Head of Year' : 'e.g. Lead Teacher'} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Your Signature *</Label>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="typed" className="flex-1 gap-2"><Type className="h-4 w-4" /> Type Name</TabsTrigger>
                <TabsTrigger value="drawn" className="flex-1 gap-2"><PenLine className="h-4 w-4" /> Draw Signature</TabsTrigger>
              </TabsList>
              <TabsContent value="typed" className="pt-3 space-y-2">
                <Input value={typedSig} onChange={e => setTypedSig(e.target.value)}
                  placeholder="Type your full name as signature..."
                  className="text-lg" style={{ fontFamily: 'Georgia, serif' }} />
                {typedSig && (
                  <p className="text-base italic text-slate-700 px-2" style={{ fontFamily: 'Georgia, serif' }}>{typedSig}</p>
                )}
              </TabsContent>
              <TabsContent value="drawn" className="pt-3 space-y-2">
                <div className="relative border-2 border-dashed border-slate-300 rounded-lg overflow-hidden bg-white">
                  <canvas ref={canvasRef} width={480} height={160} className="w-full touch-none cursor-crosshair"
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
                  {!hasDrawing && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-slate-300 text-sm">Draw your signature here</p>
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={clearCanvas} disabled={!hasDrawing}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
              </TabsContent>
            </Tabs>
          </div>

          <p className="text-xs text-slate-400">
            By saving, you confirm this is your legally binding digital signature. It will appear on all approved student achievement certificates.
          </p>

          <Button onClick={handleSave} disabled={!canSave || saving}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
            <Check className="h-4 w-4 mr-2" />
            {saving ? 'Saving Signature...' : 'Save Signature Profile'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}