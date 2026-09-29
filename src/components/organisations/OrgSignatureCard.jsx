import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PenLine, CheckCircle2, ShieldAlert } from 'lucide-react';
import SignatureSetupDialog from './SignatureSetupDialog';

/**
 * OrgSignatureCard — the signed-in member's verifier signature status with a
 * setup/replace action. Signing a verification requires a confirmed signature.
 */
export default function OrgSignatureCard({ org, me, signature, onSaved }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <PenLine className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">My signature</h3>
                {signature ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Ready
                    </Badge>
                    <img
                      src={signature.image_url}
                      alt="My signature"
                      className="h-8 rounded bg-white px-2"
                    />
                    <span className="text-xs text-muted-foreground">
                      Confirmed {signature.confirmed_at ? new Date(signature.confirmed_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="warning" className="gap-1">
                      <ShieldAlert className="h-3 w-3" /> Not set up
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Required before you can sign verifications
                    </span>
                  </div>
                )}
              </div>
            </div>
            <Button size="sm" variant={signature ? 'outline' : 'default'} onClick={() => setOpen(true)}>
              {signature ? 'Replace' : 'Set up'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <SignatureSetupDialog
        open={open}
        onOpenChange={setOpen}
        org={org}
        me={me}
        onSaved={onSaved}
      />
    </>
  );
}