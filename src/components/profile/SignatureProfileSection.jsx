import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PenLine, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

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

  if (!isEligible) return null;

  return (
    <Card className="border-border bg-card/60 backdrop-blur-md shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-foreground">
          <PenLine className="h-4 w-4 text-primary" /> Digital Signature Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted/40 flex items-center justify-center">
              <PenLine className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Signature Profile</p>
              <p className="text-xs text-muted-foreground">
                {sigProfile ? `"${sigProfile.display_name}" · ${sigProfile.signature_type === 'drawn' ? 'Hand-drawn' : 'Typed'} signature` : 'Not yet configured'}
              </p>
            </div>
          </div>
          {loading ? (
            <Badge variant="outline" className="text-muted-foreground border-border bg-muted/30">Loading…</Badge>
          ) : sigProfile ? (
            <Badge variant="outline" className="border-success/30 bg-success/10 text-success gap-1">
              <CheckCircle2 className="h-3 w-3" /> Configured
            </Badge>
          ) : (
            <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning gap-1">
              <XCircle className="h-3 w-3" /> Not Set Up
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted/40 flex items-center justify-center">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Last Signed</p>
              <p className="text-xs text-muted-foreground">
                {lastSig ? format(new Date(lastSig.signed_at), 'dd MMM yyyy, HH:mm') : 'No signatures yet'}
              </p>
            </div>
          </div>
          {lastSig && (
            <Badge variant="outline" className="text-xs text-muted-foreground border-border">
              {lastSig.signer_role}
            </Badge>
          )}
        </div>

        {!sigProfile && !loading && (
          <div className="pt-1">
            <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg p-3">
              You need to set up your signature profile before you can approve student achievement records.
              Go to any pending record to configure it.
            </p>
          </div>
        )}

        {sigProfile?.signature_type === 'drawn' && sigProfile?.signature_value && (
          <div className="pt-1">
            <p className="text-xs text-muted-foreground mb-2">Signature Preview</p>
            <div className="bg-muted/20 border border-border rounded-lg p-3 inline-block">
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
            <p className="text-xs text-muted-foreground mb-2">Signature Preview</p>
            <div className="bg-muted/20 border border-border rounded-lg p-3 inline-block">
              <p className="font-serif text-xl text-foreground italic">{sigProfile.signature_value}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}