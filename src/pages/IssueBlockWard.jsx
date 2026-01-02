import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import IssueStepper from '@/components/blockwards/IssueStepper';
import StudentPicker from '@/components/blockwards/StudentPicker';
import BlockWardPreviewCard from '@/components/blockwards/BlockWardPreviewCard';
import { api, mockTemplates, blockWardCategories, blockWardRarities } from '@/components/blockwards/mockData';
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, Award } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

function IssueBlockWardContent() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [issuingStage, setIssuingStage] = useState('');
  const [issueSuccess, setIssueSuccess] = useState(false);
  const [issueError, setIssueError] = useState(null);

  const [formData, setFormData] = useState({
    selectedStudent: null,
    title: '',
    description: '',
    category: '',
    rarity: 'Common',
    icon: '🏆',
    dateAchieved: new Date().toISOString().split('T')[0],
    confirmed: false
  });

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const data = await api.getStudents();
      setStudents(data);
    } catch (error) {
      console.error('Error loading students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !formData.selectedStudent) {
      toast.error('Please select a student');
      return;
    }
    if (currentStep === 2 && (!formData.title || !formData.category)) {
      toast.error('Please fill in required fields');
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSelectTemplate = (template) => {
    setFormData(prev => ({
      ...prev,
      title: template.title,
      description: template.description,
      category: template.category,
      rarity: template.rarity,
      icon: template.icon
    }));
  };

  const handleIssue = async () => {
    if (!formData.confirmed) {
      toast.error('Please confirm the award details');
      return;
    }

    setIssuing(true);
    setIssuingStage('Issuing on Polygon Amoy (testnet)...');

    try {
      const response = await fetch('/api/blockwards/issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: formData.selectedStudent.id,
          title: formData.title,
          category: formData.category,
          description: formData.description
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to issue BlockWard');
      }

      setIssueSuccess(true);
      toast.success('BlockWard issued successfully!');
    } catch (error) {
      console.error('Error issuing BlockWard:', error);
      setIssueError(error.message || 'Failed to issue BlockWard. Please try again.');
      toast.error('Failed to issue BlockWard');
    } finally {
      setIssuing(false);
      setIssuingStage('');
    }
  };

  const emojiOptions = ['🏆', '⭐', '🎓', '📚', '🎨', '🏅', '💡', '🔥', '✨', '🌟', '👑', '🎯'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  // Success State
  if (issueSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border-0 shadow-2xl">
            <CardContent className="p-12 text-center">
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">
                BlockWard Issued Successfully!
              </h2>
              <p className="text-slate-600 mb-8">
                {formData.selectedStudent.name} will now see "{formData.title}" in their achievements
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  variant="outline"
                  onClick={() => navigate(createPageUrl('TeacherBlockWards'))}
                >
                  View All BlockWards
                </Button>
                <Button 
                  className="bg-gradient-to-r from-violet-600 to-indigo-600"
                  onClick={() => window.location.reload()}
                >
                  <Award className="h-4 w-4 mr-2" />
                  Issue Another
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Issuing State
  if (issuing) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="border-0 shadow-2xl">
          <CardContent className="p-12 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-violet-600 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {issuingStage}
            </h2>
            <p className="text-slate-600">
              Please wait while we process your award
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error State
  if (issueError) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="border-0 shadow-2xl border-red-200">
          <CardContent className="p-12 text-center">
            <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <Award className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              Couldn't Issue BlockWard
            </h2>
            <p className="text-slate-600 mb-2">{issueError}</p>
            <p className="text-sm text-slate-500 mb-8">Error code: BW-500</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                variant="outline"
                onClick={() => setIssueError(null)}
              >
                Try Again
              </Button>
              <Button variant="outline">
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl('TeacherBlockWards'))}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Issue a BlockWard</h1>
          <p className="text-slate-500 mt-1">Recognize student achievements</p>
        </div>
      </div>

      {/* Stepper */}
      <IssueStepper currentStep={currentStep} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-8">
              {/* Step 1: Select Student */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">
                      Select Student
                    </h2>
                    <p className="text-sm text-slate-600">
                      Choose the student who will receive this achievement
                    </p>
                  </div>
                  <StudentPicker
                    students={students}
                    selectedStudent={formData.selectedStudent}
                    onSelect={(student) => setFormData({ ...formData, selectedStudent: student })}
                  />
                </div>
              )}

              {/* Step 2: Choose/Create BlockWard */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">
                      Choose or Create Award
                    </h2>
                    <p className="text-sm text-slate-600">
                      Select from templates or create a custom BlockWard
                    </p>
                  </div>

                  <Tabs defaultValue="create">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="templates">Templates</TabsTrigger>
                      <TabsTrigger value="create">Create New</TabsTrigger>
                    </TabsList>

                    <TabsContent value="templates" className="space-y-4 mt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {mockTemplates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => handleSelectTemplate(template)}
                            className="text-left p-4 rounded-xl border-2 hover:border-violet-600 transition-all"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-3xl">{template.icon}</span>
                              <div>
                                <p className="font-semibold text-slate-900">{template.title}</p>
                                <p className="text-xs text-slate-500">{template.category}</p>
                              </div>
                            </div>
                            <p className="text-sm text-slate-600">{template.description}</p>
                          </button>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="create" className="space-y-4 mt-6">
                      <div className="space-y-2">
                        <Label>Title *</Label>
                        <Input
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="e.g. Perfect Attendance"
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

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Category *</Label>
                          <Select
                            value={formData.category}
                            onValueChange={(value) => setFormData({ ...formData, category: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {blockWardCategories.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Rarity</Label>
                          <Select
                            value={formData.rarity}
                            onValueChange={(value) => setFormData({ ...formData, rarity: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {blockWardRarities.map((rarity) => (
                                <SelectItem key={rarity} value={rarity}>{rarity}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Icon</Label>
                        <div className="grid grid-cols-6 gap-2">
                          {emojiOptions.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => setFormData({ ...formData, icon: emoji })}
                              className={`text-3xl p-3 rounded-lg border-2 hover:border-violet-600 transition-all ${
                                formData.icon === emoji ? 'border-violet-600 bg-violet-50' : 'border-slate-200'
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Date Achieved</Label>
                        <Input
                          type="date"
                          value={formData.dateAchieved}
                          onChange={(e) => setFormData({ ...formData, dateAchieved: e.target.value })}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {/* Step 3: Review & Issue */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">
                      Review & Issue
                    </h2>
                    <p className="text-sm text-slate-600">
                      Confirm the details before issuing
                    </p>
                  </div>

                  <div className="p-6 bg-slate-50 rounded-xl space-y-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Awarding To</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {formData.selectedStudent.name}
                      </p>
                      <p className="text-sm text-slate-600">{formData.selectedStudent.class}</p>
                    </div>

                    <div className="h-px bg-slate-200" />

                    <div>
                      <p className="text-sm text-slate-500 mb-1">Achievement</p>
                      <p className="text-lg font-semibold text-slate-900">{formData.title}</p>
                      {formData.description && (
                        <p className="text-sm text-slate-600 mt-1">{formData.description}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <p className="text-xs text-slate-500">Category</p>
                        <p className="font-medium text-slate-900">{formData.category}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Rarity</p>
                        <p className="font-medium text-slate-900">{formData.rarity}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-violet-50 rounded-lg">
                    <Checkbox
                      id="confirm"
                      checked={formData.confirmed}
                      onCheckedChange={(checked) => setFormData({ ...formData, confirmed: checked })}
                    />
                    <label htmlFor="confirm" className="text-sm text-violet-900 cursor-pointer">
                      I confirm this award is accurate and should be permanently issued to {formData.selectedStudent.name}
                    </label>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6 mt-6 border-t">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 1}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>

                {currentStep < 3 ? (
                  <Button onClick={handleNext}>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleIssue}
                    disabled={!formData.confirmed}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600"
                  >
                    <Award className="h-4 w-4 mr-2" />
                    Issue BlockWard
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Preview</h3>
            {formData.title || formData.category ? (
              <BlockWardPreviewCard blockWard={formData} />
            ) : (
              <Card className="border-2 border-dashed border-slate-200">
                <CardContent className="p-8 text-center">
                  <Award className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-sm text-slate-500">
                    Preview will appear as you fill in the details
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IssueBlockWard() {
  return (
    <ProtectedRoute>
      <IssueBlockWardContent />
    </ProtectedRoute>
  );
}