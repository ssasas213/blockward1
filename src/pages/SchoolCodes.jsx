import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, RefreshCw, Users, GraduationCap, Shield, Check, Loader2, Power } from 'lucide-react';
import { toast } from 'sonner';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(prefix, roleSuffix) {
  const p = (prefix || 'SCH').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'SCH';
  let random = '';
  for (let i = 0; i < 6; i++) {
    random += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `${p}-${roleSuffix}-${random}`;
}

export default function SchoolCodes() {
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState(null);
  const [codes, setCodes] = useState([]);
  const [copied, setCopied] = useState({});
  const [regenerating, setRegenerating] = useState({});
  const [toggling, setToggling] = useState({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      const profile = profiles[0];
      if (!profile?.school_id) { setLoading(false); return; }

      const schools = await base44.entities.School.filter({ id: profile.school_id });
      if (schools.length > 0) setSchool(schools[0]);

      const allCodes = await base44.entities.SchoolCode.filter({ school_id: profile.school_id });
      // Sort by role_type: teacher, student, admin
      const order = { teacher: 0, student: 1, admin: 2 };
      allCodes.sort((a, b) => (order[a.role_type] ?? 9) - (order[b.role_type] ?? 9));
      setCodes(allCodes);
    } catch (error) {
      console.error('Error loading codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopied({ ...copied, [id]: true });
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied({ ...copied, [id]: false }), 2000);
  };

  const regenerateCode = async (codeRecord) => {
    setRegenerating({ ...regenerating, [codeRecord.id]: true });
    try {
      const roleSuffix = codeRecord.role_type === 'teacher' ? 'TEACH' : codeRecord.role_type === 'student' ? 'STUDENT' : 'ADMIN';
      const newCodeStr = generateCode(school?.name, roleSuffix);

      // Deactivate old code
      await base44.entities.SchoolCode.update(codeRecord.id, {
        status: 'disabled',
      });

      // Create new code
      const newCode = await base44.entities.SchoolCode.create({
        school_id: codeRecord.school_id,
        school_name: codeRecord.school_name,
        code: newCodeStr,
        role_type: codeRecord.role_type,
        status: 'active',
        created_by: school?.admin_email || '',
        label: codeRecord.label || `${codeRecord.role_type} Join Code`,
      });

      // Replace in state
      setCodes(prev => prev.map(c => c.id === codeRecord.id ? newCode : c));
      toast.success(`New ${codeRecord.role_type} code generated. Old code deactivated.`);
    } catch (error) {
      toast.error('Failed to regenerate code');
    } finally {
      setRegenerating({ ...regenerating, [codeRecord.id]: false });
    }
  };

  const toggleCodeStatus = async (codeRecord) => {
    setToggling({ ...toggling, [codeRecord.id]: true });
    try {
      const newStatus = codeRecord.status === 'active' ? 'disabled' : 'active';
      await base44.entities.SchoolCode.update(codeRecord.id, { status: newStatus });
      setCodes(prev => prev.map(c => c.id === codeRecord.id ? { ...c, status: newStatus } : c));
      toast.success(`Code ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch (error) {
      toast.error('Failed to update code status');
    } finally {
      setToggling({ ...toggling, [codeRecord.id]: false });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const codeConfig = {
    teacher: { title: 'Teacher Join Code', description: 'Share with teachers to request access', icon: Users, color: 'text-primary', bgIcon: 'bg-primary/10' },
    student: { title: 'Student Join Code', description: 'Students can also join via class codes', icon: GraduationCap, color: 'text-info', bgIcon: 'bg-info/10' },
    admin: { title: 'Admin Join Code', description: 'Highly restricted — requires owner approval', icon: Shield, color: 'text-accent', bgIcon: 'bg-accent/10' },
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">School Join Codes</h1>
        <p className="text-muted-foreground mt-1">Manage codes for {school?.name || 'your school'}</p>
      </div>

      {codes.length === 0 ? (
        <Card className="border-border bg-card/60">
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No codes found. Contact support if codes were not generated during setup.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {codes.map((codeRecord) => {
            const config = codeConfig[codeRecord.role_type] || codeConfig.teacher;
            const isActive = codeRecord.status === 'active';
            return (
              <Card key={codeRecord.id} className={`border-border bg-card/60 backdrop-blur-md ${!isActive ? 'opacity-60' : ''}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`h-11 w-11 rounded-xl ${config.bgIcon} flex items-center justify-center flex-shrink-0`}>
                      <config.icon className={`h-5 w-5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-foreground text-sm">{config.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                          {isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>

                      <div className="flex items-center gap-2 mt-3">
                        <code className="flex-1 px-3 py-2 rounded-lg bg-muted/50 text-sm font-mono font-semibold text-foreground tracking-wider">
                          {codeRecord.code}
                        </code>
                        <Button variant="outline" size="icon" onClick={() => copyCode(codeRecord.code, codeRecord.id)} className="h-9 w-9 flex-shrink-0">
                          {copied[codeRecord.id] ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>

                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-xs text-muted-foreground">
                          Used {codeRecord.use_count || 0}{codeRecord.max_uses ? ` / ${codeRecord.max_uses}` : ''} times
                        </span>
                        {codeRecord.expires_at && (
                          <span className="text-xs text-muted-foreground">
                            Expires {new Date(codeRecord.expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 mt-3">
                        <Button variant="outline" size="sm" onClick={() => regenerateCode(codeRecord)} disabled={regenerating[codeRecord.id]} className="h-8">
                          {regenerating[codeRecord.id] ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                          Regenerate
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => toggleCodeStatus(codeRecord)} disabled={toggling[codeRecord.id]} className="h-8">
                          {toggling[codeRecord.id] ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Power className="h-3.5 w-3.5 mr-1" />}
                          {isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-border bg-card/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-sm">Quick Share Links</CardTitle>
          <CardDescription>Registration links with codes embedded</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {codes.filter(c => c.status === 'active').map((codeRecord) => {
            const shareUrl = `${window.location.origin}/JoinSchool?code=${codeRecord.code}`;
            return (
              <div key={codeRecord.id} className="flex items-center gap-2">
                <Input value={shareUrl} readOnly className="flex-1 bg-muted/30 font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('Link copied'); }} className="h-9 w-9 flex-shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}