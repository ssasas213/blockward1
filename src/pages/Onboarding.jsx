import React, { useState, useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Shield, GraduationCap, Users, BookOpen, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Onboarding() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    user_type: localStorage.getItem('pendingUserRole') || '',
    first_name: '',
    last_name: '',
    school_name: '',
    school_code: '',
    student_id: '',
    grade_level: '',
    parent_name: '',
    parent_email: '',
    parent_phone: '',
    department: '',
    join_code: ''
  });

  useEffect(() => {
    // Pre-fill name if available
    const pendingName = localStorage.getItem('pendingUserName');
    if (pendingName) {
      const [firstName, ...lastNameParts] = pendingName.split(' ');
      setFormData(prev => ({
        ...prev,
        first_name: firstName,
        last_name: lastNameParts.join(' ')
      }));
      // Clear stored data
      localStorage.removeItem('pendingUserName');
      localStorage.removeItem('pendingUserRole');
    }
  }, []);

  useEffect(() => {
    checkUserProfile();
  }, []);

  const checkUserProfile = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Check if profile already exists
      const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      if (profiles.length > 0) {
        const profile = profiles[0];
        redirectToDashboard(profile.user_type);
        return;
      }
    } catch (e) {
      window.location.href = createPageUrl('Home');
    } finally {
      setLoading(false);
    }
  };

  const redirectToDashboard = (userType) => {
    if (userType === 'admin') {
      window.location.href = createPageUrl('AdminDashboard');
    } else if (userType === 'teacher') {
      window.location.href = createPageUrl('TeacherDashboard');
    } else {
      window.location.href = createPageUrl('StudentDashboard');
    }
  };

  const generateWallet = () => {
    // Simulate custodial wallet creation
    // In production: POST /api/wallet/create
    // Backend would:
    // 1. Generate new Ethereum wallet
    // 2. Encrypt private key with master encryption key
    // 3. Store encrypted key in secure database
    // 4. Return only the wallet address to frontend
    // 5. Student never sees or handles private keys

    const chars = '0123456789abcdef';
    let address = '0x';
    for (let i = 0; i < 40; i++) {
      address += chars[Math.floor(Math.random() * chars.length)];
    }
    return address;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const walletAddress = generateWallet();
      
      let school = null;
      
      // If admin, create school
      if (formData.user_type === 'admin') {
        const schoolCode = formData.school_code || `SCH${Date.now().toString(36).toUpperCase()}`;
        school = await base44.entities.School.create({
          name: formData.school_name,
          code: schoolCode,
          admin_email: user.email
        });
      }

      // Create user profile
      const profileData = {
        user_email: user.email,
        user_type: formData.user_type,
        first_name: formData.first_name,
        last_name: formData.last_name,
        wallet_address: walletAddress,
        blockchain_role: formData.user_type.toUpperCase(),
        status: 'active'
      };

      if (school) {
        profileData.school_id = school.id;
      }

      if (formData.user_type === 'student') {
        profileData.student_id = formData.student_id;
        profileData.grade_level = formData.grade_level;
        profileData.parent_name = formData.parent_name;
        profileData.parent_email = formData.parent_email;
        profileData.parent_phone = formData.parent_phone;
        profileData.total_achievement_points = 0;
        profileData.total_behaviour_points = 0;
      }

      if (formData.user_type === 'teacher') {
        profileData.department = formData.department;
        profileData.can_issue_blockwards = true; // Teachers can mint by default
      }

      await base44.entities.UserProfile.create(profileData);

      // Create default point categories and codes for admin
      if (formData.user_type === 'admin' && school) {
        const defaultCategories = [
          { name: 'Excellence', type: 'achievement', default_points: 10, color: '#8B5CF6', school_id: school.id },
          { name: 'Participation', type: 'achievement', default_points: 5, color: '#3B82F6', school_id: school.id },
          { name: 'Improvement', type: 'achievement', default_points: 5, color: '#10B981', school_id: school.id },
          { name: 'Disruption', type: 'behaviour', default_points: -5, color: '#EF4444', school_id: school.id },
          { name: 'Late', type: 'behaviour', default_points: -2, color: '#F59E0B', school_id: school.id },
        ];
        await base44.entities.PointCategory.bulkCreate(defaultCategories);

        // Generate initial school codes
        const generateCode = (prefix) => {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let code = prefix;
          for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
          }
          return code;
        };

        await base44.entities.School.update(school.id, {
          student_join_code: generateCode('STU-'),
          teacher_join_code: generateCode('TCH-')
        });
      }

      redirectToDashboard(formData.user_type);
    } catch (error) {
      console.error('Error creating profile:', error);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  const userTypes = [
    {
      value: 'admin',
      icon: Shield,
      title: 'Administrator',
      description: 'Manage school, teachers, and students'
    },
    {
      value: 'teacher',
      icon: Users,
      title: 'Teacher',
      description: 'Create classes and issue BlockWards'
    },
    {
      value: 'student',
      icon: GraduationCap,
      title: 'Student',
      description: 'Join classes and earn achievements'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-violet-500/25">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl">Welcome to BlockWard</CardTitle>
          <CardDescription>Let's set up your account</CardDescription>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <Label className="text-base mb-4 block">I am a...</Label>
                  <RadioGroup
                    value={formData.user_type}
                    onValueChange={(value) => setFormData({ ...formData, user_type: value })}
                    className="space-y-3"
                  >
                    {userTypes.map((type) => (
                      <Label
                        key={type.value}
                        htmlFor={type.value}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          formData.user_type === type.value
                            ? 'border-violet-600 bg-violet-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <RadioGroupItem value={type.value} id={type.value} className="sr-only" />
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                          formData.user_type === type.value
                            ? 'bg-violet-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          <type.icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{type.title}</p>
                          <p className="text-sm text-slate-500">{type.description}</p>
                        </div>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!formData.user_type}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                </div>

                {formData.user_type === 'admin' && (
                  <div className="space-y-2">
                    <Label>School Name</Label>
                    <Input
                      value={formData.school_name}
                      onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                      placeholder="Springfield High School"
                    />
                  </div>
                )}

                {formData.user_type === 'teacher' && (
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Input
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="Mathematics"
                    />
                  </div>
                )}

                {formData.user_type === 'student' && (
                  <>
                    <div className="space-y-2">
                      <Label>Student ID</Label>
                      <Input
                        value={formData.student_id}
                        onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                        placeholder="STU001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Grade/Year Level</Label>
                      <Input
                        value={formData.grade_level}
                        onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                        placeholder="Year 9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Parent/Guardian Name</Label>
                      <Input
                        value={formData.parent_name}
                        onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                        placeholder="Jane Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Parent/Guardian Email</Label>
                      <Input
                        type="email"
                        value={formData.parent_email}
                        onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })}
                        placeholder="parent@email.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Parent/Guardian Phone</Label>
                      <Input
                        value={formData.parent_phone}
                        onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                        placeholder="+44 123 456 7890"
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!formData.first_name || !formData.last_name || submitting || 
                      (formData.user_type === 'admin' && !formData.school_name)}
                    className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Complete Setup
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}