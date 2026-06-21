import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, FileText, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function EvidenceUpload({ evidenceUrl, evidenceType, onUpload, onClear, required = true }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const isImage = file.type.startsWith('image/');
      onUpload(file_url, isImage ? 'image' : 'file');
      toast.success('Evidence uploaded');
    } catch (e) {
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const isImage = evidenceType === 'image' || (evidenceUrl && evidenceUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i));

  return (
    <div className="space-y-3">
      {evidenceUrl ? (
        <div className="relative inline-block">
          {isImage ? (
            <img src={evidenceUrl} alt="Evidence" className="max-h-48 rounded-xl border-2 border-slate-200 shadow-sm" />
          ) : (
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border-2 border-slate-200">
              <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Evidence file uploaded</p>
                <a href={evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 hover:underline">View file</a>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onClear}
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-colors min-h-40">
          {uploading ? (
            <><Loader2 className="h-6 w-6 animate-spin text-violet-500" /> <span className="text-sm text-slate-600">Uploading...</span></>
          ) : (
            <>
              <div className="h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center">
                <Upload className="h-6 w-6 text-violet-600" />
              </div>
              <p className="text-sm font-medium text-slate-700">Upload Evidence {required && '*'}</p>
              <p className="text-xs text-slate-400">Image, PDF, certificate, or screenshot</p>
            </>
          )}
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            disabled={uploading}
          />
        </label>
      )}
      {required && !evidenceUrl && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          At least one evidence file is required before signing.
        </p>
      )}
    </div>
  );
}