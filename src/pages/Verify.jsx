import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield, CheckCircle2, Trophy, User, ExternalLink, Sparkles,
  Calendar, Download, Link2, Hash, Network, FileCheck, Building2,
  Copy, AlertCircle, GraduationCap, Award
} from 'lucide-react';
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

const CATEGORY_ICONS = {
  academic: GraduationCap,
  sports: Trophy,
  arts: Sparkles,
  leadership: Shield,
  community: User,
  behaviour: AlertCircle,
  special: Award,
};

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-sm font-medium text-slate-800 break-words">{value}</p>
      </div>
    </div>
  );
}

export default function Verify() {
  const routeParams = useParams();
  const queryParams = new URLSearchParams(window.location.search);
  const verificationId = routeParams.verification_id || queryParams.get('id');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!verificationId) { setNotFound(true); setLoading(false); return; }
    loadRecord();
  }, [verificationId]);

  const loadRecord = async () => {
    try {
      const response = await base44.functions.invoke('publicVerify', { verification_id: verificationId });
      const result = response.data;
      if (!result.ok) { setNotFound(true); setLoading(false); return; }
      setData(result);
    } catch (e) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <p className="text-slate-500 mb-4">This verification link is invalid or the achievement has been removed.</p>
          <p className="text-xs text-slate-400 font-mono break-all">Verification ID: {verificationId || 'none'}</p>
        </CardContent>
      </Card>
    </div>
  );

  const { record, teacherSignature, adminSignature, isVerified, isRevoked, message } = data;
  const gradColor = CATEGORY_COLORS[record.achievement_category] || 'from-violet-500 to-indigo-500';
  const CategoryIcon = CATEGORY_ICONS[record.achievement_category] || Award;
  const evidenceIsImage = record.evidence_file_url && record.evidence_file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const hasBlockchain = record.token_id || record.transaction_hash;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">

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
        {isRevoked ? (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl p-5 text-center flex items-center justify-center gap-3">
            <AlertCircle className="h-7 w-7 flex-shrink-0" />
            <div>
              <p className="font-bold text-lg">ACHIEVEMENT REVOKED</p>
              <p className="text-red-600 text-sm">{message || 'This achievement is no longer valid.'}</p>
            </div>
          </div>
        ) : isVerified ? (
          <div className="bg-emerald-500 text-white rounded-2xl p-6 text-center flex items-center justify-center gap-4 shadow-lg shadow-emerald-500/30">
            <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="text-left">
              <p className="font-bold text-2xl tracking-tight">VERIFIED ACHIEVEMENT</p>
              <p className="text-emerald-100 text-sm">Authentic, blockchain-verified credential</p>
            </div>
          </div>
        ) : (
          <div className="bg-amber-100 border border-amber-300 text-amber-800 rounded-2xl p-4 text-center">
            <p className="font-semibold">⚠️ Not Yet Fully Verified</p>
            <p className="text-sm">{message || 'This achievement is still in the approval process.'}</p>
          </div>
        )}

        {/* Achievement Display */}
        <Card className="border-0 shadow-xl overflow-hidden">
          <div className={`h-3 bg-gradient-to-r ${gradColor}`} />
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-6">
              {record.achievement_image ? (
                <img src={record.achievement_image} alt="Achievement badge" className="w-32 h-32 rounded-xl object-cover shadow-md flex-shrink-0" />
              ) : evidenceIsImage ? (
                <img src={record.evidence_file_url} alt="Achievement evidence" className="w-32 h-32 rounded-xl object-cover shadow-md flex-shrink-0" />
              ) : (
                <div className={`w-32 h-32 rounded-xl bg-gradient-to-br ${gradColor} flex items-center justify-center flex-shrink-0`}>
                  <CategoryIcon className="h-16 w-16 text-white/80" />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge className="bg-violet-100 text-violet-700 border-0 capitalize text-xs">{record.achievement_category}</Badge>
                  {record.nft_status === 'minted' && (
                    <Badge className="bg-indigo-100 text-indigo-700 border-0 gap-1 text-xs">
                      <Network className="h-3 w-3" /> NFT Minted
                    </Badge>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">{record.achievement_title}</h1>
                {record.achievement_description && <p className="text-slate-600 text-sm mb-3">{record.achievement_description}</p>}
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
              <InfoRow icon={User} label="Recipient" value={record.student_name} />
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <InfoRow icon={Building2} label="Organisation" value={record.organisation_name} />
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <InfoRow icon={Calendar} label="Date Approved" value={record.date_approved ? format(new Date(record.date_approved), 'MMMM d, yyyy') : null} />
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <InfoRow icon={FileCheck} label="Date Delivered" value={record.date_delivered ? format(new Date(record.date_delivered), 'MMMM d, yyyy') : null} />
            </CardContent>
          </Card>
        </div>

        {/* Verifier & Authoriser */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4" /> Verification Chain
            </h2>
            <div className="space-y-4">
              {/* Teacher */}
              <div className={`rounded-xl p-4 border-2 ${teacherSignature ? 'border-amber-200 bg-amber-50' : 'border-dashed border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">📚 Verifier (Teacher)</span>
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
                    <p className="text-xs text-slate-400 mt-1">{teacherSignature.signed_at ? format(new Date(teacherSignature.signed_at), 'MMM d, yyyy HH:mm') : ''}</p>
                  </div>
                )}
              </div>

              {/* Admin */}
              <div className={`rounded-xl p-4 border-2 ${adminSignature ? 'border-violet-200 bg-violet-50' : 'border-dashed border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">🛡️ Authoriser (Admin)</span>
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
                    <p className="text-xs text-slate-400 mt-1">{adminSignature.signed_at ? format(new Date(adminSignature.signed_at), 'MMM d, yyyy HH:mm') : ''}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evidence preview (only if public and is image) */}
        {isVerified && evidenceIsImage && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <FileCheck className="h-4 w-4" /> Evidence
              </h2>
              <img src={record.evidence_file_url} alt="Evidence" className="w-full max-h-80 object-contain rounded-xl border border-slate-200" />
            </CardContent>
          </Card>
        )}

        {/* Certificate download (if public) */}
        {isVerified && record.certificate_url && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Download className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Certificate</p>
                  <p className="text-xs text-slate-500">Download the official certificate</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={record.certificate_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                  Download <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Blockchain section (if available) */}
        {isVerified && hasBlockchain && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Network className="h-4 w-4" /> Blockchain Verification
              </h2>
              <div className="space-y-2">
                <InfoRow icon={Network} label="Network" value={record.blockchain_network} />
                <InfoRow icon={Hash} label="Contract Address" value={record.contract_address} />
                <InfoRow icon={Hash} label="Token ID" value={record.token_id} />
                {record.transaction_hash && (
                  <div className="flex items-start gap-3 py-2">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Hash className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400 font-medium">Transaction Hash</p>
                      <p className="text-sm font-mono text-slate-800 break-all">{record.transaction_hash}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Verification ID + Public URL footer */}
        <Card className="border-0 shadow-md bg-slate-50">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-500 font-medium">Verification ID</span>
              </div>
              <span className="text-sm font-mono text-slate-700">{record.verification_id || verificationId}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-500 font-medium flex-shrink-0">Public URL</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-slate-600 truncate font-mono">{record.public_verification_url || window.location.href}</span>
                <Button variant="ghost" size="icon" onClick={copyUrl} className="h-7 w-7 flex-shrink-0">
                  {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center pb-4">
          <p className="text-xs text-slate-400">
            Powered by <span className="font-semibold text-violet-600">BlockWard</span> — Verified Digital Achievements
          </p>
        </div>
      </div>
    </div>
  );
}