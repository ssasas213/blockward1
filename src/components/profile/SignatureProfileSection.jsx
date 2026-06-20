import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PenLine, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function SignatureProfileSection({ userEmail, userRole }) {
  const [sigProfile, setSigProfile] = useState(null);
  const [lastSig, setLastSig] = useState(null);
  const [loading, setLoading] = useState(true);

  const isEligible = ['teacher', 'admin'].includes(userRole);

  useEffect(() => {
    if (!userEmail || !isEligible) {
      setLoading(false);
      return;
    }
    load();
  }, [userEmail, userRole]);

  const load = async () => {
    try {
      const [profiles, sigs] = await Promise.all([
        base44.entities.SignatureProfile.filter({ user_email: userEmail }),
        base44.entities.DigitalSignature.filter({ signer_email: userEmail }),
      ]);
      setSigProfile(profiles[0] || null);
      if (sigs.length > 0) {
        const sorted = [...sigs].sort((a, b) => new Date(b.signed_at) - new Date(a.signed_at));
        setLastSig(sorted[0]);
      }
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  // Only show for teachers and admins — AFTER all hooks
  if (!isEligible) return null;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PenLine className="h-4 w-4" /> Digital Signature Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-white shadow-sm flex items-center justify-center">
              <PenLine className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Signature Profile</p>
              <p className="text-xs text-slate-400">
                {sigProfile ? `"${sigProfile.display_name}" · ${sigProfile.signature_type === 'drawn' ? 'Hand-drawn' : 'Typed'} signature` : 'Not yet configured'}
              </p>
            </div>
          </div>
          {loading ? (
            <Badge className="bg-slate-100 text-slate-400 border-0">Loading…</Badge>
          ) : sigProfile ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Configured
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-700 border-0 gap-1">
              <XCircle className="h-3 w-3" /> Not Set Up
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-white shadow-sm flex items-center justify-center">
              <Clock className="h-4 w-4 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Last Signed</p>
              <p className="text-xs text-slate-400">
                {lastSig ? format(new Date(lastSig.signed_at), 'dd MMM yyyy, HH:mm') : 'No signatures yet'}
              </p>
            </div>
          </div>
          {lastSig && (
            <Badge variant="outline" className="text-xs">
              {lastSig.signer_role}
            </Badge>
          )}
        </div>

        {!sigProfile && !loading && (
          <div className="pt-1">
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              You need to set up your signature profile before you can approve student achievement records.
              Go to any pending record to configure it.
            </p>
          </div>
        )}

        {sigProfile?.signature_type === 'drawn' && sigProfile?.signature_value && (
          <div className="pt-1">
            <p className="text-xs text-slate-400 mb-2">Signature Preview</p>
            <div className="bg-white border border-slate-200 rounded-lg p-3 inline-block">
              <img
                src={sigProfile.signature_value}
                alt="Signature"
                className="h-12 object-contain"
              />
            </div>
          </div>
        )}
        {sigProfile?.signature_type === 'typed' && sigProfile?.signature_value && (
          <div className="pt-1">
            <p className="text-xs text-slate-400 mb-2">Signature Preview</p>
            <div className="bg-white border border-slate-200 rounded-lg p-3 inline-block">
              <p className="font-serif text-xl text-slate-700 italic">{sigProfile.signature_value}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}