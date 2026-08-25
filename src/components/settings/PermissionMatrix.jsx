import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users } from 'lucide-react';

// Reference matrix for who can do what across the achievement workflow.
// (The duplicated "View portfolio vault" row was removed — kept the canonical
// "View Portfolio Vault" entry only.)
const ROWS = [
  ['Submit achievement', '✅', '✅ (on behalf)', '❌'],
  ['Upload evidence', '✅', '✅', '❌'],
  ['Review evidence', '❌', '✅ (own classes)', '✅'],
  ['Teacher sign', '❌', '✅', '❌'],
  ['Reject record', '❌', '✅', '✅'],
  ['Admin sign & verify', '❌', '❌', '✅'],
  ['Send to Student Vault', '❌', '❌', '✅'],
  ['View own records', '✅', '❌', '❌'],
  ['View all school records', '❌', '✅ (classes)', '✅'],
  ['View Portfolio Vault', '✅', '❌', '❌'],
  ['Manage users', '❌', '❌', '✅'],
];

export default function PermissionMatrix() {
  return (
    <Card className="border-border bg-card/60 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Permission Matrix
        </CardTitle>
        <CardDescription>Who can do what across the achievement workflow (reference)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Action</th>
                <th className="text-center py-2 px-3 text-info font-medium">Student</th>
                <th className="text-center py-2 px-3 text-warning font-medium">Teacher</th>
                <th className="text-center py-2 px-3 text-primary font-medium">Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ROWS.map(([action, student, teacher, admin]) => (
                <tr key={action}>
                  <td className="py-2 pr-4 text-foreground">{action}</td>
                  <td className="text-center py-2 px-3 text-xs">{student}</td>
                  <td className="text-center py-2 px-3 text-xs">{teacher}</td>
                  <td className="text-center py-2 px-3 text-xs">{admin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}