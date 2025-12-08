import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, RefreshCw, Users, GraduationCap, Shield, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function SchoolCodes() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [school, setSchool] = useState(null);
  const [regenerating, setRegenerating] = useState({});
  const [copied, setCopied] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      
      if (profiles.length > 0) {
        setProfile(profiles[0]);
        
        if (profiles[0].school_id) {
          const schools = await base44.entities.School.filter({ id: profiles[0].school_id });
          if (schools.length > 0) {
            setSchool(schools[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCode = (prefix) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = prefix;
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const regenerateCode = async (type) => {
    setRegenerating({ ...regenerating, [type]: true });
    try {
      const newCode = generateCode(type === 'student' ? 'STU-' : 'TCH-');
      const updateData = type === 'student' 
        ? { student_join_code: newCode }
        : { teacher_join_code: newCode };
      
      await base44.entities.School.update(school.id, updateData);
      setSchool({ ...school, ...updateData });
      toast.success(`New ${type} code generated`);
    } catch (error) {
      toast.error('Failed to regenerate code');
    } finally {
      setRegenerating({ ...regenerating, [type]: false });
    }
  };

  const copyCode = (code, type) => {
    navigator.clipboard.writeText(code);
    setCopied({ ...copied, [type]: true });
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied({ ...copied, [type]: false }), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (profile?.user_type !== 'admin') {
    return (
      <div className="text-center py-12">
        <Shield className="h-16 w-16 mx-auto text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Admin Access Required</h2>
        <p className="text-slate-600">Only administrators can manage school codes</p>
      </div>
    );
  }

  const codes = [
    {
      type: 'student',
      title: 'Student Join Code',
      description: 'Share this code with students to join your school',
      code: school?.student_join_code || 'Not generated',
      icon: GraduationCap,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50'
    },
    {
      type: 'teacher',
      title: 'Teacher Join Code',
      description: 'Share this code with teachers to join your school',
      code: school?.teacher_join_code || 'Not generated',
      icon: Users,
      color: 'from-violet-500 to-purple-500',
      bgColor: 'bg-violet-50'
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">School Join Codes</h1>
        <p className="text-slate-500 mt-1">Manage codes for students and teachers to join {school?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {codes.map((item) => (
          <Card key={item.type} className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg`}>
                  <item.icon className="h-7 w-7 text-white" />
                </div>
                <div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`p-6 ${item.bgColor} rounded-xl`}>
                <Label className="text-sm text-slate-600 mb-2 block">Current Code</Label>
                <div className="flex items-center gap-3">
                  <code className="flex-1 text-2xl font-bold text-slate-900 tracking-wider">
                    {item.code}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyCode(item.code, item.type)}
                    className="h-10 w-10"
                  >
                    {copied[item.type] ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <Copy className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => regenerateCode(item.type)}
                  disabled={regenerating[item.type]}
                  className="flex-1"
                >
                  {regenerating[item.type] ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerate Code
                    </>
                  )}
                </Button>
              </div>

              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
                <strong>How to use:</strong> {item.type === 'student' ? 'Students' : 'Teachers'} can enter this code during signup or in their profile settings to join {school?.name}.
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Quick Share</CardTitle>
          <CardDescription>Copy registration links with codes embedded</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {codes.map((item) => {
            const shareUrl = `${window.location.origin}?school_code=${item.code}`;
            return (
              <div key={item.type} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Input value={shareUrl} readOnly className="flex-1 bg-white" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    toast.success('Link copied');
                  }}
                >
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