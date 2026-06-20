import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Trash2, PenLine } from 'lucide-react';

export default function SignatureStep({ profile, schoolName, signature, signedAt, onSign, onClear }) {
  const sigRef = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleEnd = () => {
    setIsEmpty(sigRef.current?.isEmpty() ?? true);
  };

  const handleClear = () => {
    sigRef.current?.clear();
    setIsEmpty(true);
    onClear();
  };

  const handleConfirm = () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    const base64 = sigRef.current.toDataURL('image/png');
    onSign(base64, new Date().toISOString());
  };

  // Already signed — show preview
  if (signature) {
    return (
      <div className="space-y-4">
        <div className="border-2 border-green-300 bg-green-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm font-semibold text-green-800">Signature captured</p>
          </div>
          <img src={signature} alt="Teacher signature" className="max-h-24 border border-green-200 rounded-lg bg-white p-2" />
          <p className="text-xs text-green-700 mt-2">
            Signed by <strong>{profile?.first_name} {profile?.last_name}</strong>
            {signedAt ? ` · ${new Date(signedAt).toLocaleString()}` : ''}
          </p>
        </div>
        <Button variant="outline" onClick={handleClear} className="gap-2 text-red-600 border-red-200 hover:bg-red-50">
          <PenLine className="h-4 w-4" /> Re-sign
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Signer info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
        <p><span className="font-semibold">Teacher:</span> {profile ? `${profile.first_name} ${profile.last_name}` : '—'}</p>
        {schoolName && <p><span className="font-semibold">School:</span> {schoolName}</p>}
        <p><span className="font-semibold">Date:</span> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
      </div>

      {/* Canvas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Sign Here *</p>
          {!isEmpty && (
            <Button type="button" variant="ghost" size="sm" onClick={handleClear}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1 h-8">
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
        <div className={`relative border-2 rounded-xl overflow-hidden transition-colors ${!isEmpty ? 'border-violet-400 bg-white' : 'border-dashed border-slate-300 bg-slate-50'}`}>
          <SignatureCanvas
            ref={sigRef}
            penColor="#1e293b"
            canvasProps={{ className: 'w-full', height: 180, style: { touchAction: 'none' } }}
            onEnd={handleEnd}
          />
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <PenLine className="h-7 w-7 text-slate-300 mx-auto mb-1" />
                <p className="text-sm text-slate-400">Sign here using your mouse or finger</p>
              </div>
            </div>
          )}
          <div className="absolute bottom-8 left-6 right-6 border-b border-slate-300 pointer-events-none" />
          <p className="absolute bottom-2 left-6 text-xs text-slate-400 pointer-events-none">Signature</p>
        </div>
        <p className="text-xs text-slate-400">
          By signing, you confirm this BlockWard is accurate and authentic. Your signature will be permanently stored.
        </p>
      </div>

      <Button
        onClick={handleConfirm}
        disabled={isEmpty}
        className="w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 text-white gap-2 disabled:opacity-40"
      >
        <CheckCircle2 className="h-5 w-5" /> Confirm Signature & Continue
      </Button>
    </div>
  );
}