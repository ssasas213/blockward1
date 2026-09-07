import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, Mail, Building2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MarketingShell from '@/components/marketing/MarketingShell';
import { base44 } from '@/api/base44Client';

const TOPICS = [
  { value: 'organisations', label: 'Schools & organisations' },
  { value: 'student_support', label: 'Student support' },
  { value: 'verification_support', label: 'Verification help' },
  { value: 'partnerships', label: 'Press & partnerships' },
];

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', organisation: '', topic: 'organisations', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { document.title = 'Contact — BlockWard'; }, []);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: typeof v === 'string' ? v : v?.target?.value ?? v }));

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('submitContactMessage', form);
      if (res.data?.ok) setSent(true);
      else setError(res.data?.error || 'Something went wrong. Please try again.');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <MarketingShell
      title="Talk to us."
      subtitle="Whether you run an organisation of two hundred students or you're checking your first credential — we read everything and we reply."
    >
      <section className="py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Quick answers */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-border bg-card/40 backdrop-blur-md p-5">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Checking a credential?</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You don't need us for that — the verification tool is public and instant.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.href = '/verify'}>
                Open the verification tool
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card/40 backdrop-blur-md p-5">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Connecting your organisation?</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Setting up a school or club is self-serve and takes minutes. An overview of how it works is on the organisations page.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.href = '/ForOrganisations'}>
                See how it works
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card/40 backdrop-blur-md p-5">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Something else?</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Use the form and pick the topic that fits — it reaches the right person.
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-3 rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6 sm:p-8">
            {sent ? (
              <div className="py-10 text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Message received</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Thanks — we've got your message and will reply to {form.email} as soon as we can.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-topic">Topic</Label>
                  <Select value={form.topic} onValueChange={set('topic')}>
                    <SelectTrigger id="contact-topic"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TOPICS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-name">Your name</Label>
                    <Input id="contact-name" required value={form.name} onChange={set('name')} placeholder="Jane Doe" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email">Email</Label>
                    <Input id="contact-email" type="email" required value={form.email} onChange={set('email')} placeholder="you@email.com" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-org">Organisation <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="contact-org" value={form.organisation} onChange={set('organisation')} placeholder="Riverside Secondary School" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-message">Message</Label>
                  <Textarea id="contact-message" required rows={6} value={form.message} onChange={set('message')} placeholder="How can we help?" />
                </div>
                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={sending}>
                  {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Send message
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}