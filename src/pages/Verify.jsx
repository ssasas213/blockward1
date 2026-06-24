import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle2, Trophy, User, ExternalLink, Sparkles, School, Calendar, Award } from 'lucide-react';
import { format } from 'date-fns';

const CATEGORY_COLORS = {
  academic: 'from-blue-500 to-indigo-500',
  sports: 'from-green-500 to-emerald-500',
  arts: 'from-pink-500 to-rose-500',
  leadership: 'from-purple-500 to-violet-500',
  community: 'from-amber-500 to-orange-500',
  behaviour: 'from-red-500 to-rose-500',
  special: 'from-indigo-500 to-purple-500',
};

export default function Verify() {
  const params = new URLSearchParams(window.location.search);
  const verifyId = params.get('id');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!verifyId) { setNotFound(true); setLoading(false); return; }
    loadRecord();
  }, [verifyId]);

  const loadRecord = async () => {
    try {
      const response = await base44.functions.invoke('publicVerify', { verify_id: verifyId });
      const result = response.data;
      if (!result.ok) { setNotFound(true); setLoading(false); return; }
      setData(result);
    } catch (e) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-0 shadow-xl text-center">
        <CardContent className="py-16">
          <div className="h-16 w-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Achievement Not Found</h1>
          <p className="text-slate-500">This verification link is invalid or the achievement has been removed.</p>
        </CardContent>
      </Card>
    </div>
  );

  const { record, school, teacherSignature, adminSignature, isVerified } = data;
  const gradColor = CATEGORY_COLORS[record.category] || 'from-violet-500 to-indigo-500';

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">BlockWard</span>
          </div>
          <p className="text-slate-500 text-sm">Achievement Verification Portal</p>
        </div>

        {/* Verified badge */}
        {isVerified ? (
          <div className="bg-emerald-500 text-white rounded-2xl p-5 text-center flex items-center justify-center gap-3 shadow-lg">
            <CheckCircle2 className="h-7 w-7 flex-shrink-0" />
            <div>
              <p className="font-bold text-lg">VERIFIED ACHIEVEMENT</p>
              <p className="text-emerald-100 text-sm">This achievement has been verified and signed by a teacher and administrator</p>
            </div>
          </div>
        ) : (
          <div className="bg-amber-100 border border-amber-300 text-amber-800 rounded-2xl p-4 text-center">
            <p className="font-semibold">⚠️ Not Yet Fully Verified</p>
            <p className="text-sm">{data.message || 'This achievement is still in the approval process.'}</p>
          </div>
        )}

        {/* Achievement Display */}
        <Card className="border-0 shadow-xl overflow-hidden">
          <div className={`h-3 bg-gradient-to-r ${gradColor}`} />
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-6">
              {record.file_url && record.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img src={record.file_url} alt="Achievement evidence" className="w-32 h-32 rounded-xl object-cover shadow-md flex-shrink-0" />
              ) : (
                <div className={`w-32 h-32 rounded-xl bg-gradient-to-br ${gradColor} flex items-center justify-center flex-shrink-0`}>
                  <Trophy className="h-16 w-16 text-white/80" />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-violet-600" />
                  <Badge className="bg-violet-100 text-violet-700 border-0 capitalize text-xs">{record.category}</Badge>
                  {record.points > 0 && (
                    <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">+{record.points} pts</Badge>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">{record.title}</h1>
                {record.description && <p className="text-slate-600 text-sm mb-3">{record.description}</p>}
                {record.date_achieved && (
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Achieved: {format(new Date(record.date_achieved), 'MMMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-blue-500" />
                <p className="font-semibold text-slate-700 text-sm">Recipient</p>
              </div>
              <p className="font-bold text-slate-900">{record.student_name}</p>
              <p className="text-xs text-slate-400">{record.student_email}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <School className="h-4 w-4 text-purple-500" />
                <p className="font-semibold text-slate-700 text-sm">Institution</p>
              </div>
              <p className="font-bold text-slate-900">{school?.name || 'School'}</p>
              {record.class_name && <p className="text-xs text-slate-400">{record.class_name}</p>}
            </CardContent>
          </Card>
        </div>

        {/* Signatures */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4" /> Digital Signatures
            </h2>
            <div className="space-y-4">
              {/* Teacher sig */}
              <div className={`rounded-xl p-4 border-2 ${teacherSignature ? 'border-amber-200 bg-amber-50' : 'border-dashed border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">📚 Teacher Endorsement</span>
                  {teacherSignature
                    ? <Badge className="bg-amber-100 text-amber-700 border-0 gap-1"><CheckCircle2 className="h-3 w-3" /> Signed</Badge>
                    : <Badge className="bg-slate-100 text-slate-500 border-0">Pending</Badge>
                  }
                </div>
                {teacherSignature && (
                  <div>
                    <p className="font-medium text-slate-800">{teacherSignature.signer_name}</p>
                    {teacherSignature.signer_title && <p className="text-xs text-slate-500">{teacherSignature.signer_title}</p>}
                    {teacherSignature.signature_type === 'drawn'
                      ? <img src={teacherSignature.signature_value} alt="sig" className="h-10 mt-2 border rounded bg-white" />
                      : <p className="text-xl italic text-slate-700 mt-1" style={{ fontFamily: 'Georgia, serif' }}>{teacherSignature.signature_value}</p>
                    }
                    <p className="text-xs text-slate-400 mt-1">{format(new Date(teacherSignature.signed_at), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                )}
              </div>

              {/* Admin sig */}
              <div className={`rounded-xl p-4 border-2 ${adminSignature ? 'border-violet-200 bg-violet-50' : 'border-dashed border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">🛡️ Admin Approval</span>
                  {adminSignature
                    ? <Badge className="bg-violet-100 text-violet-700 border-0 gap-1"><CheckCircle2 className="h-3 w-3" /> Signed</Badge>
                    : <Badge className="bg-slate-100 text-slate-500 border-0">Pending</Badge>
                  }
                </div>
                {adminSignature && (
                  <div>
                    <p className="font-medium text-slate-800">{adminSignature.signer_name}</p>
                    {adminSignature.signer_title && <p className="text-xs text-slate-500">{adminSignature.signer_title}</p>}
                    {adminSignature.signature_type === 'drawn'
                      ? <img src={adminSignature.signature_value} alt="sig" className="h-10 mt-2 border rounded bg-white" />
                      : <p className="text-xl italic text-slate-700 mt-1" style={{ fontFamily: 'Georgia, serif' }}>{adminSignature.signature_value}</p>
                    }
                    <p className="text-xs text-slate-400 mt-1">{format(new Date(adminSignature.signed_at), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Verification ID footer */}
        <div className="text-center space-y-1">
          <p className="text-xs text-slate-400">
            Verification ID: <span className="font-mono">{verifyId}</span>
          </p>
          <p className="text-xs text-slate-400">
            Powered by <span className="font-semibold text-violet-600">BlockWard</span> — Verified Digital Achievements
          </p>
        </div>
      </div>
    </div>
  );
}