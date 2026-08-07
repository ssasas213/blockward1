import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ProfilePictureUploader from '@/components/profile/ProfilePictureUploader';
import {
  School, Camera, Wallet, Check, ArrowRight, ArrowLeft,
  Loader2, Sparkles, ShieldCheck, Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'school', label: 'Verify School', icon: School },
  { key: 'photo', label: 'Profile Photo', icon: Camera },
  { key: 'vault', label: 'Link Vault', icon: Wallet },
];

function schoolSubtitle(school) {
  if (!school) return '';
  const parts = [
    (school.school_type || 'school').replace(/_/g, ' '),
    school.city,
    school.country,
  ].filter(Boolean);
  return parts.join(' \u00b7 ');
}

export default function StudentOnboarding() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [vaultCreating, setVaultCreating] = useState(false);
  const [vaultAddress, setVaultAddress] = useState('');

  useEffect(() => { init(); }, []);

  const init = async () => {
    try {
      const me = await base44.auth.me();
      if (!me) { window.location.href = '/Login'; return; }
      setUser(me);

      const profiles = await base44.entities.UserProfile.filter({ user_email: me.email });
      const p = profiles[0] || null;
      if (!p) { window.location.href = createPageUrl('Onboarding'); return; }
      if (p.user_type !== 'student') { redirectByRole(p.user_type); return; }
      if (!p.school_id) { window.location.href = createPageUrl('JoinSchool'); return; }

      setProfile(p);
      if (p.wallet_address) setVaultAddress(p.wallet_address);

      const schools = await base44.entities.School.filter({ id: p.school_id });
      if (schools.length > 0) setSchool(schools[0]);
    } catch {
      window.location.href = '/Login';
    } finally {
      setLoading(false);
    }
  };

  const redirectByRole = (role) => {
    const page = role === 'admin' ? 'AdminDashboard' : role === 'teacher' ? 'TeacherDashboard' : 'StudentDashboard';
    window.location.href = createPageUrl(page);
  };

  const createVault = async () => {
    setVaultCreating(true);
    try {
      const res = await base44.functions.invoke('createVaultForUser', { userId: user.id });
      const data = res.data;
      if (data?.success) {
        setVaultAddress(data.vaultAddress);
        setProfile(prev => prev ? { ...prev, wallet_address: data.vaultAddress } : prev);
        toast.success('Your portfolio vault is linked');
      } else {
        toast.error(data?.error || 'Failed to create vault');
      }
    } catch (e) {
      toast.error(e?.message || 'Failed to create vault');
    } finally {
      setVaultCreating(false);
    }
  };

  const finish = () => redirectByRole('student');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isLast = step === STEPS.length - 1;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4 shadow-glow">
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Welcome to BlockWard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Let's set up your account in a few quick steps, {profile?.first_name}.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all',
                  active ? 'border-primary bg-primary/10 text-primary'
                    : done ? 'border-success/40 bg-success/10 text-success'
                    : 'border-border text-muted-foreground'
                )}>
                  {done ? <Check className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
                  <span className="text-xs font-medium hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={cn('h-px w-4 sm:w-6', done ? 'bg-success/50' : 'bg-border')} />}
              </div>
            );
          })}
        </div>

        <Card className="border-border bg-card/60 backdrop-blur-md">
          <CardContent className="p-6">
            {/* STEP 1 — VERIFY SCHOOL */}
            {step === 0 && (
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <School className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Verify your school</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Confirm this is the school you belong to. Your achievements and BlockWards will be linked here.
                </p>

                <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/30">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {school?.logo_url ? (
                      <img src={school.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
                    ) : (
                      <Building2 className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{school?.name || 'Your school'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{schoolSubtitle(school)}</p>
                  </div>
                </div>

                <button
                  onClick={() => base44.auth.logout(window.location.origin + '/Login')}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Not your school? Sign out and join with the correct code.
                </button>
              </div>
            )}

            {/* STEP 2 — PROFILE PHOTO */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Add a profile photo</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  A photo helps your teachers recognise you. You can skip this and add it later.
                </p>
                <ProfilePictureUploader
                  profile={profile}
                  onUpdated={(updated) => setProfile(updated)}
                />
              </div>
            )}

            {/* STEP 3 — LINK VAULT */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Link your portfolio vault</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your vault is a secure blockchain wallet that permanently stores your verified BlockWards.
                  Create it now so you're ready to receive achievements.
                </p>

                {vaultAddress ? (
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-success/40 bg-success/10">
                    <ShieldCheck className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Vault linked</p>
                      <p className="text-xs text-muted-foreground font-mono break-all mt-1">{vaultAddress}</p>
                    </div>
                  </div>
                ) : (
                  <Button onClick={createVault} disabled={vaultCreating} className="w-full">
                    {vaultCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                      <Wallet className="h-4 w-4 mr-2" /> Create My Vault
                    </>}
                  </Button>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-6 mt-2 border-t border-border">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep(s => s - 1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
              )}
              <Button onClick={() => isLast ? finish() : setStep(s => s + 1)} className="flex-1">
                {isLast ? <>Go to Dashboard <ArrowRight className="h-4 w-4 ml-2" /></> : <>Continue <ArrowRight className="h-4 w-4 ml-2" /></>}
              </Button>
            </div>
          </CardContent>
        </Card>

        <button
          onClick={finish}
          className="block mx-auto mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip setup for now
        </button>
      </div>
    </div>
  );
}