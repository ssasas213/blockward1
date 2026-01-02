import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
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
  const [status, setStatus] = useState(null); // null | 'pending' | 'minted' | 'failed'

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.studentId || !formData.title) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIssuing(true);
    setStatus('pending');

    try {
      // Simulate blockchain minting process
      await new Promise(resolve => setTimeout(resolve, 2000));

      const selectedStudent = students.find(s => s.id === formData.studentId);
      
      // In production: Call backend API to mint NFT to student's wallet
      // const result = await base44.integrations.Core.MintBlockWard({
      //   studentWallet: selectedStudent.wallet_address,
      //   title: formData.title,
      //   description: formData.description,
      //   category: formData.category
      // });

      setStatus('minted');
      toast.success('BlockWard issued successfully!');
      
      // Reset form
      setFormData({
        studentId: '',
        title: '',
        description: '',
        category: 'academic'
      });

      if (onIssueSuccess) onIssueSuccess();
    } catch (error) {
      setStatus('failed');
      toast.error('Failed to issue BlockWard');
      console.error(error);
    } finally {
      setIssuing(false);
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-violet-600" />
          Issue BlockWard
        </CardTitle>
        <CardDescription>
          Award a verified achievement to a student's BlockWard Vault
        </CardDescription>
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

          {status && (
            <div className={`p-4 rounded-lg ${
              status === 'pending' ? 'bg-blue-50 text-blue-900' :
              status === 'minted' ? 'bg-green-50 text-green-900' :
              'bg-red-50 text-red-900'
            }`}>
              <div className="flex items-center gap-2">
                {status === 'pending' && <Loader2 className="h-5 w-5 animate-spin" />}
                {status === 'minted' && <CheckCircle className="h-5 w-5" />}
                {status === 'failed' && <AlertCircle className="h-5 w-5" />}
                <span className="font-medium">
                  {status === 'pending' && 'Issuing BlockWard...'}
                  {status === 'minted' && 'BlockWard issued successfully!'}
                  {status === 'failed' && 'Failed to issue BlockWard'}
                </span>
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