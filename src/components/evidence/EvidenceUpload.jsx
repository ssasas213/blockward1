import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { validateEvidenceFile, processEvidenceImage } from '@/lib/achievementImages';
import { Upload, Loader2, FileText, ImageIcon, X, Replace, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX = 5;
const TYPES = 'image/jpeg,image/png,image/webp,application/pdf';

function isImage(name) { return /\.(jpe?g|png|webp)$/i.test(name || ''); }
function isPdf(name) { return /\.pdf$/i.test(name || ''); }

/**
 * EvidenceUpload — multi-file supporting-evidence uploader for the Add
 * Achievement form. Stores private file URIs (a copied URI is worthless
 * without a permission-checked signed URL). While editing, holds local
 * object URLs for image thumbnails; only { name, url } is persisted on save.
 *
 * Props:
 *  - value: [{ name, url }]
 *  - onChange(newArray)
 *  - max (default 5)
 *  - helpText
 */
export default function EvidenceUpload({ value = [], onChange, max = MAX, helpText, onBusyChange }) {
  const [uploading, setUploading] = useState(false);
  const setBusy = (b) => { setUploading(b); onBusyChange?.(b); };
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const replaceIdxRef = useRef(null);

  const items = value || [];

  const addFiles = async (files, replaceIndex = null) => {
    const room = replaceIndex !== null ? 1 : max - items.length;
    if (room <= 0) { toast.error(`You can attach up to ${max} pieces of evidence`); return; }
    const candidates = Array.from(files || []).slice(0, room);
    if (!candidates.length) return;
    setBusy(true);
    try {
      const added = [];
      for (const file of candidates) {
        const err = validateEvidenceFile(file);
        if (err) { toast.error(`${file.name}: ${err}`); continue; }
        const processed = await processEvidenceImage(file);
        const res = await base44.integrations.Core.UploadPrivateFile({ file: processed });
        if (res?.file_uri) {
          added.push({ name: file.name, url: res.file_uri, size: file.size, type: file.type });
        }
      }
      if (added.length) {
        if (replaceIndex !== null) {
          const next = [...items];
          next[replaceIndex] = added[0];
          onChange(next);
        } else {
          onChange([...items, ...added]);
        }
      }
    } catch {
      toast.error('Upload failed — try again');
    } finally {
      setBusy(false);
      replaceIdxRef.current = null;
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  const onPick = (e) => {
    const idx = replaceIdxRef.current;
    if (idx !== null) addFiles(e.target.files, idx);
    else addFiles(e.target.files);
  };

  const triggerReplace = (i) => {
    replaceIdxRef.current = i;
    inputRef.current?.click();
  };

  const remove = (i) => onChange(items.filter((_, j) => j !== i));

  const hasItems = items.length > 0;
  const room = max - items.length;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {hasItems && (
        <div className="space-y-2 mb-2">
          {items.map((item, i) => {
            const image = isImage(item.name);
            const pdf = isPdf(item.name);
            return (
              <div key={(item.url || '') + i} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                <div className="h-11 w-11 flex-shrink-0 rounded-md overflow-hidden border border-border bg-secondary/60 flex items-center justify-center">
                  {image && item.previewUrl && <img src={item.previewUrl} alt={item.name} className="h-full w-full object-cover" />}
                  {image && !item.previewUrl && <ImageIcon className="h-4 w-4 text-tertiary" />}
                  {pdf && <FileText className="h-5 w-5 text-primary" />}
                  {!image && !pdf && <FileText className="h-5 w-5 text-tertiary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{item.name}</p>
                  <p className="text-[11px] text-tertiary uppercase tracking-wide">
                    {pdf ? 'PDF' : image ? 'Image' : 'Document'}
                    {item.size ? ` · ${formatSize(item.size)}` : ''}
                    <span className="text-success normal-case ml-1.5">· Uploaded</span>
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button type="button" size="sm" variant="ghost" onClick={() => triggerReplace(i)} className="h-8 px-2" title="Replace">
                    <Replace className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} className="h-8 px-2 text-muted-foreground hover:text-destructive" title="Remove">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {room > 0 && (
        <label
          className={cn(
            'block cursor-pointer',
            !hasItems && 'rounded-xl border-2 border-dashed p-8 text-center transition-colors',
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-hover/30'
          )}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input ref={inputRef} type="file" multiple accept={TYPES} className="hidden" onChange={onPick} />
          {hasItems ? (
            <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-hover transition-colors">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add another file
            </span>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                {uploading ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : <Upload className="h-5 w-5 text-primary" />}
              </div>
              <p className="text-sm font-medium text-foreground">
                {uploading ? 'Uploading…' : 'Upload certificate'}
              </p>
              <p className="text-xs text-tertiary">
                PDF, PNG, JPG or WEBP · drag &amp; drop or click to choose
              </p>
              <span className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium">
                <Upload className="h-3.5 w-3.5" /> Choose file
              </span>
            </div>
          )}
        </label>
      )}

      {helpText && <p className="text-xs text-tertiary mt-2">{helpText}</p>}
    </div>
  );
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}