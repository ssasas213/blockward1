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
import PageHeader from '@/components/ui/page-header';
import EmptyState from '@/components/ui/empty-state';
import { CardSkeleton } from '@/components/ui/loading-skeleton';
import {
  Award, Search, User, Check, ArrowLeft,
  Loader2, AlertTriangle, TrendingUp, TrendingDown
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

        const [memberships, allClasses] = await Promise.all([
          base44.entities.StaffMembership.filter({ user_email: user.email }),
          base44.entities.Class.list()
        ]);
        const membership = memberships[0];
        let teacherClasses = [];
        if (membership?.class_ids?.length > 0) {
          teacherClasses = allClasses.filter(c => membership.class_ids.includes(c.id));
        } else {
          teacherClasses = allClasses.filter(c =>
            c.teacher_email === user.email ||
            (c.co_teachers && c.co_teachers.includes(user.email))
          );
        }
        setClasses(teacherClasses);

        if (preselectedClass) {
          setSelectedClass(preselectedClass);
          loadClassStudents(preselectedClass);
        }

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
      const enrollments = await base44.entities.Enrollment.filter({ class_id: classId, status: 'active' });
      if (enrollments.length > 0) {
        const emails = enrollments.map(e => e.student_email);
        const allProfiles = await base44.entities.UserProfile.list();
        setStudents(allProfiles.filter(p => emails.includes(p.user_email) && p.user_type === 'student'));
      } else {
        const cls = classes.find(c => c.id === classId);
        if (cls?.student_emails?.length > 0) {
          const allProfiles = await base44.entities.UserProfile.list();
          setStudents(allProfiles.filter(p => cls.student_emails.includes(p.user_email) && p.user_type === 'student'));
        } else {
          setStudents([]);
        }
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
      const points = customPoints ? parseInt(customPoints) : selectedCategory.default_points;
      const classData = classes.find(c => c.id === selectedClass);

      const res = await base44.functions.invoke('issuePoints', {
        student_email: selectedStudent.user_email,
        student_name: `${selectedStudent.first_name} ${selectedStudent.last_name}`,
        class_id: selectedClass,
        class_name: classData?.name,
        category_id: selectedCategory.id,
        category_name: selectedCategory.name,
        type: selectedCategory.type,
        points,
        reason,
      });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);

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
      <div className="space-y-6">
        <PageHeader title="Issue Points" description="Award achievement or behaviour points to students" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Issue Points" description="Award achievement or behaviour points to students">
        <Button variant="outline" asChild>
          <Link to={createPageUrl('TeacherDashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
      </PageHeader>

      {/* No categories warning */}
      {categories.length === 0 && (
        <div className="flex items-start gap-4 p-5 bg-warning/10 border border-warning/30 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">No point categories set up yet</p>
            <p className="text-sm text-muted-foreground mt-1">An admin needs to create point categories before you can issue points.</p>
            <Link to={createPageUrl('PointCategories')} className="text-sm text-warning font-semibold underline mt-2 inline-block">
              Go to Point Categories →
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Student Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Class Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Select Class</CardTitle>
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Select Student</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/40 hover:bg-hover/50'
                        }`}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          selectedStudent?.id === student.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {student.first_name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{student.first_name} {student.last_name}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="success" className="text-xs">+{student.total_achievement_points || 0}</Badge>
                            <Badge variant="destructive" className="text-xs">-{student.total_behaviour_points || 0}</Badge>
                          </div>
                        </div>
                        {selectedStudent?.id === student.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={User} title="No students in this class" />
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
                  <div className="h-20 w-20 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4">
                    <Check className="h-10 w-10 text-success" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Points Issued!</h3>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Achievement Categories */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-success" />
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
                            ? 'border-success bg-success/10'
                            : 'border-border hover:border-success/40 hover:bg-hover/50'
                        } ${!selectedStudent ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color || 'hsl(142 71% 45%)' }} />
                          <span className="font-medium text-foreground">{cat.name}</span>
                        </div>
                        <Badge variant="success">+{cat.default_points}</Badge>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                {/* Behaviour Categories */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-destructive" />
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
                            ? 'border-destructive bg-destructive/10'
                            : 'border-border hover:border-destructive/40 hover:bg-hover/50'
                        } ${!selectedStudent ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color || 'hsl(0 72% 51%)' }} />
                          <span className="font-medium text-foreground">{cat.name}</span>
                        </div>
                        <Badge variant="destructive">{cat.default_points}</Badge>
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
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Confirm Points</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Issuing to</p>
                          <p className="font-semibold text-foreground">{selectedStudent.first_name} {selectedStudent.last_name}</p>
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
                          variant={selectedCategory.type === 'achievement' ? 'success' : 'destructive'}
                          className="w-full"
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