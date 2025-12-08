import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Award, Search, User, Check, ArrowLeft,
  Loader2, Star, AlertTriangle, TrendingUp, TrendingDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function IssuePoints() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [reason, setReason] = useState('');
  const [customPoints, setCustomPoints] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successAnimation, setSuccessAnimation] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const preselectedClass = urlParams.get('class');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      
      if (profiles.length > 0) {
        setProfile(profiles[0]);

        // Load classes
        const teacherClasses = await base44.entities.Class.filter({ teacher_email: user.email });
        setClasses(teacherClasses);

        // Preselect class if provided
        if (preselectedClass) {
          setSelectedClass(preselectedClass);
          loadClassStudents(preselectedClass);
        }

        // Load point categories
        const cats = await base44.entities.PointCategory.list();
        setCategories(cats);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClassStudents = async (classId) => {
    try {
      const classData = await base44.entities.Class.filter({ id: classId });
      if (classData.length > 0 && classData[0].student_emails?.length > 0) {
        const allProfiles = await base44.entities.UserProfile.list();
        const classStudents = allProfiles.filter(p => 
          classData[0].student_emails.includes(p.user_email) && p.user_type === 'student'
        );
        setStudents(classStudents);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const handleClassChange = (classId) => {
    setSelectedClass(classId);
    setSelectedStudent(null);
    loadClassStudents(classId);
  };

  const handleIssuePoints = async () => {
    if (!selectedStudent || !selectedCategory || !reason) return;

    setSubmitting(true);
    try {
      const user = await base44.auth.me();
      const points = customPoints ? parseInt(customPoints) : selectedCategory.default_points;
      const classData = classes.find(c => c.id === selectedClass);

      const pointEntry = {
        school_id: profile?.school_id,
        student_email: selectedStudent.user_email,
        student_name: `${selectedStudent.first_name} ${selectedStudent.last_name}`,
        teacher_email: user.email,
        teacher_name: `${profile?.first_name} ${profile?.last_name}`,
        class_id: selectedClass,
        class_name: classData?.name,
        category_id: selectedCategory.id,
        category_name: selectedCategory.name,
        type: selectedCategory.type,
        points: selectedCategory.type === 'achievement' ? Math.abs(points) : -Math.abs(points),
        reason,
        timestamp: new Date().toISOString()
      };

      await base44.entities.PointEntry.create(pointEntry);

      // Update student's total points
      const currentAchievement = selectedStudent.total_achievement_points || 0;
      const currentBehaviour = selectedStudent.total_behaviour_points || 0;

      if (selectedCategory.type === 'achievement') {
        await base44.entities.UserProfile.update(selectedStudent.id, {
          total_achievement_points: currentAchievement + Math.abs(points)
        });
      } else {
        await base44.entities.UserProfile.update(selectedStudent.id, {
          total_behaviour_points: currentBehaviour + Math.abs(points)
        });
      }

      setSuccessAnimation(true);
      setTimeout(() => {
        setSuccessAnimation(false);
        setSelectedStudent(null);
        setSelectedCategory(null);
        setReason('');
        setCustomPoints('');
        loadClassStudents(selectedClass);
      }, 1500);

      toast.success('Points issued successfully!');
    } catch (error) {
      console.error('Error issuing points:', error);
      toast.error('Failed to issue points');
    } finally {
      setSubmitting(false);
    }
  };

  const achievementCategories = categories.filter(c => c.type === 'achievement');
  const behaviourCategories = categories.filter(c => c.type === 'behaviour');

  const filteredStudents = students.filter(s => 
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link to={createPageUrl('TeacherDashboard')} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Issue Points</h1>
        <p className="text-slate-500 mt-1">Award achievement or behaviour points to students</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Student Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Class Selection */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Select Class</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedClass} onValueChange={handleClassChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Students List */}
          {selectedClass && (
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Select Student</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search students..."
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {filteredStudents.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredStudents.map((student) => (
                      <motion.button
                        key={student.id}
                        onClick={() => setSelectedStudent(student)}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                          selectedStudent?.id === student.id
                            ? 'border-violet-500 bg-violet-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          selectedStudent?.id === student.id ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {student.first_name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900">{student.first_name} {student.last_name}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-green-600 text-xs">+{student.total_achievement_points || 0}</Badge>
                            <Badge variant="outline" className="text-red-600 text-xs">-{student.total_behaviour_points || 0}</Badge>
                          </div>
                        </div>
                        {selectedStudent?.id === student.id && (
                          <Check className="h-5 w-5 text-violet-500" />
                        )}
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No students in this class</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Point Assignment */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {successAnimation ? (
              <motion.div
                key="success"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="h-full flex items-center justify-center"
              >
                <div className="text-center">
                  <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <Check className="h-10 w-10 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Points Issued!</h3>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                {/* Achievement Categories */}
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      Achievement Points
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {achievementCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat)}
                        disabled={!selectedStudent}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                          selectedCategory?.id === cat.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-slate-200 hover:border-slate-300'
                        } ${!selectedStudent ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color || '#10B981' }} />
                          <span className="font-medium">{cat.name}</span>
                        </div>
                        <Badge className="bg-green-100 text-green-700">+{cat.default_points}</Badge>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                {/* Behaviour Categories */}
                <Card className="border-0 shadow-lg mt-6">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-red-500" />
                      Behaviour Points
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {behaviourCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat)}
                        disabled={!selectedStudent}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                          selectedCategory?.id === cat.id
                            ? 'border-red-500 bg-red-50'
                            : 'border-slate-200 hover:border-slate-300'
                        } ${!selectedStudent ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color || '#EF4444' }} />
                          <span className="font-medium">{cat.name}</span>
                        </div>
                        <Badge className="bg-red-100 text-red-700">{cat.default_points}</Badge>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                {/* Issue Form */}
                {selectedStudent && selectedCategory && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="border-0 shadow-lg mt-6">
                      <CardHeader>
                        <CardTitle className="text-lg">Confirm Points</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-lg">
                          <p className="text-sm text-slate-500">Issuing to</p>
                          <p className="font-semibold">{selectedStudent.first_name} {selectedStudent.last_name}</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Custom Points (optional)</Label>
                          <Input
                            type="number"
                            value={customPoints}
                            onChange={(e) => setCustomPoints(e.target.value)}
                            placeholder={`Default: ${selectedCategory.default_points}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Reason *</Label>
                          <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Enter reason for points..."
                            rows={3}
                          />
                        </div>
                        <Button 
                          onClick={handleIssuePoints}
                          disabled={!reason || submitting}
                          className={`w-full ${
                            selectedCategory.type === 'achievement'
                              ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                              : 'bg-gradient-to-r from-red-500 to-rose-500'
                          }`}
                        >
                          {submitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Award className="h-4 w-4 mr-2" />
                              Issue {customPoints || selectedCategory.default_points} Points
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}