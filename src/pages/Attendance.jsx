import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarIcon, Check, X, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Attendance() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadStudents();
      loadAttendance();
    }
  }, [selectedClass, selectedDate]);

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
      }
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const loadAttendance = async () => {
    // Load attendance records for selected date
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const records = {};
    
    // Initialize all as not marked
    students.forEach(s => {
      records[s.user_email] = 'not_marked';
    });
    
    setAttendance(records);
  };

  const markAttendance = (studentEmail, status) => {
    setAttendance(prev => ({
      ...prev,
      [studentEmail]: status
    }));
  };

  const saveAttendance = () => {
    toast.success('Attendance saved successfully');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700';
      case 'absent': return 'bg-red-100 text-red-700';
      case 'late': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
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
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Attendance Tracking</h1>
        <p className="text-slate-500 mt-1">Monitor and record student attendance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Select Date</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Class Selection</CardTitle>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {cls?.name} - {format(selectedDate, 'PPP')}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {students.length} students
                </p>
              </div>
              <Button onClick={saveAttendance}>
                Save Attendance
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {students.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                        {student.first_name[0]}{student.last_name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="text-sm text-slate-500">{student.student_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={attendance[student.user_email] === 'present' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => markAttendance(student.user_email, 'present')}
                        className={attendance[student.user_email] === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={attendance[student.user_email] === 'late' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => markAttendance(student.user_email, 'late')}
                        className={attendance[student.user_email] === 'late' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={attendance[student.user_email] === 'absent' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => markAttendance(student.user_email, 'absent')}
                        className={attendance[student.user_email] === 'absent' ? 'bg-red-600 hover:bg-red-700' : ''}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}