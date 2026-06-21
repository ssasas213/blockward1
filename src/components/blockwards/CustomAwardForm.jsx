import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const CATEGORY_ICONS = {
  academic: '📚', sports: '🏅', arts: '🎨', leadership: '🌟', community: '🤝', special: '✨'
};

const COLOR_OPTIONS = [
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Emerald', value: '#059669' },
];

const EMOJI_OPTIONS = ['🏆', '📚', '🏅', '🎨', '🌟', '🤝', '✨', '🎖️', '🥇', '🎯', '💡', '🚀', '⭐', '🔥', '💎', '👑'];

export default function CustomAwardForm({ data, onChange }) {
  const [uploadingNft, setUploadingNft] = useState(false);

  const update = (field, value) => onChange({ ...data, [field]: value });

  const handleNftImageUpload = async (file) => {
    if (!file) return;
    setUploadingNft(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      update('nftImageUrl', file_url);
      toast.success('NFT image uploaded');
    } catch (e) {
      toast.error('Failed to upload image');
    } finally {
      setUploadingNft(false);
    }
  };

  return (
    <div className="space-y-5 p-5 bg-gradient-to-br from-violet-50 to-indigo-50 border-2 border-violet-300 rounded-xl">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">✨</span>
        <p className="text-sm font-semibold text-violet-700">Create Custom Award</p>
        <p className="text-xs text-violet-500 ml-auto">Saved to this record only — not a school-wide template</p>
      </div>

      {/* Title */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Award Title *</Label>
        <Input
          value={data.title || ''}
          onChange={e => update('title', e.target.value)}
          placeholder="e.g. Top in Mathematics — Year 9 Term 3"
          className="bg-white"
        />
      </div>

      {/* Category */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Category *</Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORY_ICONS).map(([key, icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => update('category', key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${
                data.category === key
                  ? 'border-violet-500 bg-violet-100 text-violet-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
              }`}
            >
              {icon} {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Description</Label>
        <Textarea
          value={data.description || ''}
          onChange={e => update('description', e.target.value)}
          placeholder="Describe this achievement..."
          rows={2}
          className="bg-white resize-none"
        />
      </div>

      {/* Points */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Points / Value</Label>
        <Input
          type="number"
          min="0"
          value={data.points ?? ''}
          onChange={e => update('points', e.target.value ? Number(e.target.value) : 0)}
          placeholder="0"
          className="bg-white max-w-32"
        />
      </div>

      {/* Icon */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Award Icon</Label>
        <div className="flex flex-wrap gap-1.5">
          {EMOJI_OPTIONS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => update('icon', emoji)}
              className={`h-9 w-9 rounded-lg text-lg flex items-center justify-center border-2 transition-all ${
                data.icon === emoji ? 'border-violet-500 bg-violet-100' : 'border-slate-200 bg-white hover:border-violet-300'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Award Color</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map(color => (
            <button
              key={color.value}
              type="button"
              onClick={() => update('color', color.value)}
              className={`h-8 w-8 rounded-full border-2 transition-all ${
                data.color === color.value ? 'border-slate-800 scale-110' : 'border-white shadow-sm'
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* NFT Image Upload (optional) */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Custom NFT Image (Optional)</Label>
        {data.nftImageUrl ? (
          <div className="relative inline-block">
            <img src={data.nftImageUrl} alt="NFT preview" className="h-24 w-24 rounded-xl object-cover border-2 border-violet-300" />
            <button
              type="button"
              onClick={() => update('nftImageUrl', '')}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-violet-300 rounded-xl cursor-pointer hover:bg-violet-50 transition-colors">
            {uploadingNft ? (
              <><Loader2 className="h-4 w-4 animate-spin text-violet-500" /> Uploading...</>
            ) : (
              <><Upload className="h-4 w-4 text-violet-500" /> <span className="text-sm text-slate-600">Upload NFT image</span></>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleNftImageUpload(e.target.files[0])}
              disabled={uploadingNft}
            />
          </label>
        )}
      </div>
    </div>
  );
}