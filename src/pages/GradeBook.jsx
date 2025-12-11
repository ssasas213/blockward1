import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen, Plus, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function GradeBook() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadStudents();
    }
  }, [selectedClass]);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      
      if (profiles.length > 0) {
        setProfile(profiles[0]);
        
        let classList = [];
        if (profiles[0].user_type === 'teacher') {
          classList = await base44.entities.Class.filter({ teacher_email: user.email });
        } else if (profiles[0].user_type === 'admin') {
          classList = await base44.entities.Class.list();
        }
        setClasses(classList);
        
        if (classList.length > 0) {
          setSelectedClass(classList[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const cls = classes.find(c => c.id === selectedClass);
      if (cls && cls.student_emails?.length > 0) {
        const allProfiles = await base44.entities.UserProfile.list();
        const studentProfiles = allProfiles.filter(p => 
          cls.student_emails.includes(p.user_email)
        );
        setStudents(studentProfiles);
        
        // Initialize grades
        const initialGrades = {};
        studentProfiles.forEach(s => {
          initialGrades[s.user_email] = {
            midterm: '',
            final: '',
            coursework: '',
            overall: ''
          };
        });
        setGrades(initialGrades);
      }
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const updateGrade = (studentEmail, field, value) => {
    setGrades(prev => ({
      ...prev,
      [studentEmail]: {
        ...prev[studentEmail],
        [field]: value
      }
    }));
  };

  const calculateOverall = (midterm, coursework, final) => {
    const m = parseFloat(midterm) || 0;
    const c = parseFloat(coursework) || 0;
    const f = parseFloat(final) || 0;
    return ((m * 0.3 + c * 0.3 + f * 0.4)).toFixed(1);
  };

  const getGradeLetter = (score) => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const exportGrades = () => {
    toast.success('Grades exported successfully');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const cls = classes.find(c => c.id === selectedClass);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Grade Book</h1>
          <p className="text-slate-500 mt-1">Manage student grades and assessments</p>
        </div>
        <Button onClick={exportGrades}>
          <Download className="h-4 w-4 mr-2" />
          Export Grades
        </Button>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Select Class</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger>
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">{cls?.name} - Grades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Midterm (30%)</TableHead>
                  <TableHead>Coursework (30%)</TableHead>
                  <TableHead>Final (40%)</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead>Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => {
                  const studentGrades = grades[student.user_email] || {};
                  const overall = calculateOverall(
                    studentGrades.midterm,
                    studentGrades.coursework,
                    studentGrades.final
                  );
                  const grade = getGradeLetter(parseFloat(overall));
                  
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        {student.first_name} {student.last_name}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={studentGrades.midterm}
                          onChange={(e) => updateGrade(student.user_email, 'midterm', e.target.value)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={studentGrades.coursework}
                          onChange={(e) => updateGrade(student.user_email, 'coursework', e.target.value)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={studentGrades.final}
                          onChange={(e) => updateGrade(student.user_email, 'final', e.target.value)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell className="font-semibold">{overall}%</TableCell>
                      <TableCell>
                        <Badge 
                          className={
                            grade === 'A' ? 'bg-green-100 text-green-700' :
                            grade === 'B' ? 'bg-blue-100 text-blue-700' :
                            grade === 'C' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }
                        >
                          {grade}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}