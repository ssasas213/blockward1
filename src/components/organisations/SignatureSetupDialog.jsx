import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SignatureCanvas from 'react-signature-canvas';
import { Loader2, PenLine, Upload, ShieldCheck } from 'lucide-react';

function dataUrlToFile(dataUrl) {
  const [meta, b64] = dataUrl.split(',');
  const mime = (meta.match(/:(.*?);/) || [])[1] || 'image/png';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], 'signature.png', { type: mime });
}

/**
 * SignatureSetupDialog — draw or upload a verifier signature, confirm
 * ownership and consent, and save it as the verifier's active signature.
 */
export default function SignatureSetupDialog({ open, onOpenChange, org, me, onSaved }) {
  const [tab, setTab] = useState('drawn');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const padRef = useRef(null);

  const reset = () => {
    setTab('drawn');
    setConsent(false);
    setError('');
    setUploadedUrl(null);
    if (padRef.current) padRef.current.clear();
  };

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const up = await base44.integrations.Core.UploadPublicFile({ file });
      setUploadedUrl(up.file_url);
    } catch (e) {
      setError(e?.response?.data?.error || 'Upload failed — please try again');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      let imageUrl = uploadedUrl;
      if (tab === 'drawn') {
        if (!padRef.current || padRef.current.isEmpty()) throw new Error('Draw your signature first');
        const dataUrl = padRef.current.getTrimmedCanvas().toDataURL('image/png');
        const up = await base44.integrations.Core.UploadPublicFile({ file: dataUrlToFile(dataUrl) });
        imageUrl = up.file_url;
      }
      if (!imageUrl) throw new Error('Upload your signature image first');
      if (!consent) throw new Error('Please confirm the signature statement below');
      const res = await base44.functions.invoke('verifierSignatureSetup', {
        action: 'save',
        method: tab,
        image_url: imageUrl,
        member_id: me?.membership_id || null,
        org_id: org?.id || null,
        consent: true,
      });
      if (!res?.data?.ok) throw new Error(res?.data?.error || 'Could not save your signature');
      toast.success('Your signature is ready');
      onSaved?.(res.data.signature);
      onOpenChange(false);
      reset();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Signature setup failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-primary" />
            Set up your verifier signature
          </DialogTitle>
          <DialogDescription>
            This signature is applied to credentials only when you explicitly approve a verification request.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="drawn" className="gap-2"><PenLine className="h-4 w-4" /> Draw</TabsTrigger>
            <TabsTrigger value="uploaded" className="gap-2"><Upload className="h-4 w-4" /> Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="drawn" className="pt-4">
            <div className="rounded-xl border border-border bg-white">
              <SignatureCanvas
                ref={padRef}
                penColor="#1e1b2e"
                canvasProps={{ className: 'w-full h-36' }}
              />
            </div>
            <button
              onClick={() => padRef.current?.clear()}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </TabsContent>

          <TabsContent value="uploaded" className="pt-4">
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading}
              onChange={(e) => uploadFile(e.target.files?.[0])}
            />
            {uploading && (
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
              </p>
            )}
            {uploadedUrl && (
              <div className="mt-3 rounded-xl border border-border bg-white p-3 flex items-center justify-center">
                <img src={uploadedUrl} alt="Signature preview" className="max-h-24" />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <label className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 p-3 cursor-pointer">
          <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
          <span className="text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="inline h-3.5 w-3.5 mr-1 text-primary" />
            I confirm that this is my signature and I authorise Blockward to apply it when I explicitly approve
            credential verification requests.
          </span>
        </label>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || uploading}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}