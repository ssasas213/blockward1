/**
 * StudentPortfolioVault — Student's personal Google Drive vault.
 * Students connect their own Google Drive here.
 * Shows all archived achievements saved to their Drive.
 * Connector ID: 6a2967c08ac8557a7b3a1b2e (BlockWard Student Drive)
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HardDrive, ExternalLink, CheckCircle2, AlertCircle, Loader2, Link2, FolderOpen, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const CONNECTOR_ID = '6a2967c08ac8557a7b3a1b2e';

export default function StudentPortfolioVault() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [vaultEntries, setVaultEntries] = useState([]);
  const [records, setRecords] = useState([]);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const authed = await base44.auth.isAuthenticated();
    if (!authed) { base44.auth.redirectToLogin(); return; }
    const me = await base44.auth.me();
    setUser(me);
    const profiles = await base44.entities.UserProfile.filter({ user_email: me.email });
    setProfile(profiles[0] || null);
    await loadVaultData(me.email);
    setLoading(false);
  };

  // Rule 2: reusable fetch — also serves as connection check
  const loadVaultData = async (email) => {
    try {
      const [vault, recs] = await Promise.all([
        base44.entities.DriveVault.filter({ student_email: email || user?.email }),
        base44.entities.StudentRecord.filter({ student_email: email || user?.email, status: 'archived' })
      ]);
      setVaultEntries(vault.sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at)));
      setRecords(recs);
      setConnected(true);
    } catch (e) {
      setConnected(false);
    }
  };

  // Rule 3: OAuth popup with polling
  const handleConnect = async () => {
    setConnecting(true);
    try {
      const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
      const popup = window.open(url, '_blank', 'width=500,height=600');
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setConnecting(false);
          loadVaultData();
          toast.success('Google Drive connected! Your vault is ready.');
        }
      }, 500);
    } catch (e) {
      setConnecting(false);
      toast.error('Failed to start connection: ' + e.message);
    }
  };

  const handleDisconnect = async () => {
    await base44.connectors.disconnectAppUser(CONNECTOR_ID);
    setConnected(false);
    setVaultEntries([]);
    toast.success('Google Drive disconnected');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Portfolio Vault</h1>
        <p className="text-slate-500 mt-1">Your verified achievements and NFT certificates saved to your personal Google Drive</p>
      </div>

      {/* Drive Connection Status */}
      <Card className={`border-0 shadow-lg ${connected ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-amber-400'}`}>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${connected ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                <HardDrive className={`h-6 w-6 ${connected ? 'text-emerald-600' : 'text-amber-600'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800">Google Drive</p>
                  {connected
                    ? <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1 text-xs"><CheckCircle2 className="h-3 w-3" /> Connected</Badge>
                    : <Badge className="bg-amber-100 text-amber-700 border-0 gap-1 text-xs"><AlertCircle className="h-3 w-3" /> Not Connected</Badge>
                  }
                </div>
                <p className="text-sm text-slate-500">
                  {connected
                    ? `${vaultEntries.length} certificate${vaultEntries.length !== 1 ? 's' : ''} saved to your Drive`
                    : 'Connect your Google Drive to receive verified achievement certificates'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {connected ? (
                <Button variant="outline" size="sm" onClick={handleDisconnect} className="border-red-200 text-red-600 hover:bg-red-50">
                  Disconnect
                </Button>
              ) : (
                <Button onClick={handleConnect} disabled={connecting}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                  {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <HardDrive className="h-4 w-4 mr-2" />}
                  {connecting ? 'Connecting...' : 'Connect Google Drive'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!connected && (
        <Card className="border-0 shadow-md bg-gradient-to-br from-violet-50 to-indigo-50">
          <CardContent className="p-6 text-center">
            <FolderOpen className="h-12 w-12 text-violet-400 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-800 mb-2">Why connect Google Drive?</h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              When an admin mints your NFT achievement, it gets automatically saved to your personal Google Drive in a secure folder: <strong>BlockWard / School / Your Name / Awards and Records</strong>. You'll own those files permanently.
            </p>
          </CardContent>
        </Card>
      )}

      {connected && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Certificates Saved', value: vaultEntries.length, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Minted Records', value: records.length, color: 'text-violet-600 bg-violet-50' },
              { label: 'Pending Approval', value: 0, color: 'text-amber-600 bg-amber-50' },
            ].map(s => (
              <Card key={s.label} className="border-0 shadow-sm">
                <CardContent className={`p-4 text-center rounded-xl ${s.color.split(' ')[1]}`}>
                  <p className={`text-3xl font-bold ${s.color.split(' ')[0]}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Vault Entries */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="h-4 w-4" /> Saved Certificates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vaultEntries.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Trophy className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No certificates saved yet</p>
                  <p className="text-sm mt-1">Your verified achievements will appear here after an admin mints and archives them.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vaultEntries.map(entry => {
                    const rec = records.find(r => r.id === entry.record_id);
                    return (
                      <div key={entry.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                            <Trophy className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{rec?.title || 'Achievement'}</p>
                            <p className="text-xs text-slate-400">
                              {entry.drive_folder_path} · {entry.saved_at ? format(new Date(entry.saved_at), 'MMM d, yyyy') : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {entry.drive_url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={entry.drive_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open in Drive
                              </a>
                            </Button>
                          )}
                          {rec && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={createPageUrl(`RecordDetail?id=${rec.id}`)}>
                                <Link2 className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}