import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HardDrive, CheckCircle2, XCircle, FolderOpen, Loader2 } from 'lucide-react';

export default function DriveVaultSection({ userEmail, userType }) {
  const [vaults, setVaults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userEmail) return;
    load();
  }, [userEmail]);

  const load = async () => {
    try {
      const records = await base44.entities.DriveVault.filter({ student_email: userEmail, status: 'saved' });
      setVaults(records);
    } catch (_) {
      // entity may not exist yet
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Google Drive Vault
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading vault info…
          </div>
        </CardContent>
      </Card>
    );
  }

  const connected = vaults.length > 0;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HardDrive className="h-4 w-4" /> Google Drive Vault
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Connection status */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-white shadow-sm flex items-center justify-center">
              <HardDrive className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Drive Connection</p>
              <p className="text-xs text-slate-400">
                {connected ? `${vaults.length} document(s) archived` : 'No certificates saved yet'}
              </p>
            </div>
          </div>
          {connected ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Connected
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-700 border-0 gap-1">
              <XCircle className="h-3 w-3" /> No documents
            </Badge>
          )}
        </div>

        {/* Vault folder locations */}
        {connected && (
          <div className="space-y-2 mt-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Vault Folders</p>
            {vaults.slice(0, 5).map(v => (
              <div key={v.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 text-xs">
                <FolderOpen className="h-3 w-3 text-slate-400 flex-shrink-0" />
                <span className="text-slate-600 truncate">{v.drive_folder_path || 'Root folder'}</span>
                {v.drive_url && (
                  <a href={v.drive_url} target="_blank" rel="noopener noreferrer"
                    className="text-violet-600 hover:text-violet-800 flex-shrink-0 ml-auto font-medium">
                    Open
                  </a>
                )}
              </div>
            ))}
            {vaults.length > 5 && (
              <p className="text-xs text-slate-400 pl-2">+{vaults.length - 5} more folders</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}