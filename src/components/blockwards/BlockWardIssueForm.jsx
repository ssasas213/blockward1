import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const categories = ['academic', 'sports', 'arts', 'leadership', 'community', 'special'];

export default function BlockWardIssueForm({ students, onIssueSuccess }) {
  const [formData, setFormData] = useState({
    studentId: '',
    title: '',
    description: '',
    category: 'academic'
  });
  const [issuing, setIssuing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.studentId || !formData.title) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIssuing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/blockwards/issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: formData.studentId,
          title: formData.title,
          category: formData.category,
          description: formData.description
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to issue BlockWard');
      }

      setResult({
        txHash: data.txHash,
        tokenId: data.tokenId,
        network: data.network || 'polygon-amoy'
      });

      toast.success('BlockWard issued successfully!');
      
      // Reset form
      setFormData({
        studentId: '',
        title: '',
        description: '',
        category: 'academic'
      });

      if (onIssueSuccess) onIssueSuccess();
    } catch (err) {
      setError(err.message);
      toast.error('Failed to issue BlockWard');
      console.error(err);
    } finally {
      setIssuing(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-violet-600" />
              Issue BlockWard
            </CardTitle>
            <CardDescription>
              Award a verified achievement to a student's BlockWard Vault
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            Testnet: Polygon Amoy
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Student *</Label>
            <Select
              value={formData.studentId}
              onValueChange={(value) => setFormData({ ...formData, studentId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.first_name} {student.last_name} - {student.grade_level || 'N/A'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Achievement Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Top in Mathematics - Term 1"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the achievement..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {issuing && (
            <div className="p-4 rounded-lg bg-blue-50 text-blue-900">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-medium">Issuing on Polygon Amoy (testnet)...</span>
              </div>
            </div>
          )}

          {result && (
            <div className="p-4 rounded-lg bg-green-50 text-green-900 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Verified on Polygon Amoy</span>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-green-700">Token ID:</span>
                  <span className="ml-2 font-mono">{result.tokenId}</span>
                </div>
                <div>
                  <span className="text-green-700">Transaction Hash:</span>
                  <span className="ml-2 font-mono text-xs break-all">{result.txHash}</span>
                </div>
                <a
                  href={`https://amoy.polygonscan.com/tx/${result.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-green-700 hover:text-green-800 font-medium"
                >
                  View Transaction
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-red-50 text-red-900">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <span className="font-medium">Failed</span>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={issuing || !formData.studentId || !formData.title}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          >
            {issuing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Issuing...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Issue BlockWard
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}