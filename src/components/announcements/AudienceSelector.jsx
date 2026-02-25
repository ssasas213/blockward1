import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Loader2 } from 'lucide-react';

const YEAR_GROUPS = [
  { id: 'year_7', name: 'Year 7' },
  { id: 'year_8', name: 'Year 8' },
  { id: 'year_9', name: 'Year 9' },
  { id: 'year_10', name: 'Year 10' },
  { id: 'year_11', name: 'Year 11' },
];

const TEAMS = [
  'Maths Department',
  'Science Department',
  'English Department',
  'Humanities Department',
  'Arts & PE Department',
  'SLT (Senior Leadership Team)',
  'All Teaching Staff',
  'All Support Staff',
  'All Staff',
];

// audience: { scopeType, yearGroupId, yearGroupName, classId, className, teamName, studentEmails, studentNames }
export default function AudienceSelector({ value, onChange, userType, userEmail, schoolId }) {
  const [myClasses, setMyClasses] = useState([]);
  const [myStudents, setMyStudents] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const scopeType = value.scopeType || 'SCHOOL';
  const isAdmin = userType === 'admin';
  const isTeacher = userType === 'teacher';

  // Available scope options per role
  const scopeOptions = [
    ...(isAdmin ? [{ value: 'SCHOOL', label: '🏫 Whole School' }] : []),
    { value: 'YEAR_GROUP', label: '📚 Year Group' },
    { value: 'CLASS', label: '🎓 Class' },
    ...(isAdmin ? [{ value: 'TEAM', label: '👥 Staff Team / Department' }] : []),
    { value: 'STUDENTS', label: '🎯 Specific Students' },
  ];

  // Load teacher's classes when CLASS or STUDENTS is selected
  useEffect(() => {
    if ((scopeType === 'CLASS' || scopeType === 'STUDENTS') && userEmail) {
      setLoadingClasses(true);
      const query = isAdmin ? (schoolId ? { school_id: schoolId } : {}) : { teacher_email: userEmail };
      base44.entities.Class.filter(query, 'name', 50)
        .then(classes => setMyClasses(classes || []))
        .catch(() => setMyClasses([]))
        .finally(() => setLoadingClasses(false));
    }
  }, [scopeType, userEmail]);

  // Load students when a class is selected for STUDENTS scope
  useEffect(() => {
    if (scopeType === 'STUDENTS' && value.classId) {
      setLoadingStudents(true);
      base44.entities.Enrollment.filter({ class_id: value.classId, status: 'active' }, 'student_name', 100)
        .then(enrollments => {
          const students = (enrollments || []).map(e => ({
            email: e.student_email,
            name: e.student_name || e.student_email,
          }));
          setMyStudents(students);
        })
        .catch(() => setMyStudents([]))
        .finally(() => setLoadingStudents(false));
    }
  }, [value.classId, scopeType]);

  const handleScopeChange = (newScope) => {
    onChange({ scopeType: newScope });
  };

  const toggleStudent = (student) => {
    const current = value.studentEmails || [];
    const currentNames = value.studentNames || [];
    if (current.includes(student.email)) {
      onChange({
        ...value,
        studentEmails: current.filter(e => e !== student.email),
        studentNames: currentNames.filter(n => n !== student.name),
      });
    } else {
      onChange({
        ...value,
        studentEmails: [...current, student.email],
        studentNames: [...currentNames, student.name],
      });
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium">Send To</Label>
        <Select value={scopeType} onValueChange={handleScopeChange}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scopeOptions.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Year Group picker */}
      {scopeType === 'YEAR_GROUP' && (
        <div>
          <Label className="text-sm">Select Year Group</Label>
          <Select
            value={value.yearGroupId || ''}
            onValueChange={id => {
              const yg = YEAR_GROUPS.find(y => y.id === id);
              onChange({ ...value, yearGroupId: id, yearGroupName: yg?.name || id });
            }}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Choose year group..." />
            </SelectTrigger>
            <SelectContent>
              {YEAR_GROUPS.map(y => (
                <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Class picker */}
      {scopeType === 'CLASS' && (
        <div>
          <Label className="text-sm">Select Class</Label>
          {loadingClasses ? (
            <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading classes...
            </div>
          ) : (
            <Select
              value={value.classId || ''}
              onValueChange={id => {
                const cls = myClasses.find(c => c.id === id);
                onChange({ ...value, classId: id, className: cls?.name || id });
              }}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Choose class..." />
              </SelectTrigger>
              <SelectContent>
                {myClasses.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Team / Department picker */}
      {scopeType === 'TEAM' && (
        <div>
          <Label className="text-sm">Select Team / Department</Label>
          <Select
            value={value.teamName || ''}
            onValueChange={name => onChange({ ...value, teamName: name })}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Choose team..." />
            </SelectTrigger>
            <SelectContent>
              {TEAMS.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Students picker */}
      {scopeType === 'STUDENTS' && (
        <div className="space-y-2">
          <Label className="text-sm">Select Class First</Label>
          {loadingClasses ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading classes...
            </div>
          ) : (
            <Select
              value={value.classId || ''}
              onValueChange={id => {
                const cls = myClasses.find(c => c.id === id);
                onChange({ ...value, classId: id, className: cls?.name || id, studentEmails: [], studentNames: [] });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose class to pick students from..." />
              </SelectTrigger>
              <SelectContent>
                {myClasses.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {value.classId && (
            <div>
              <Label className="text-sm">Pick Students</Label>
              {loadingStudents ? (
                <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading students...
                </div>
              ) : (
                <div className="mt-1.5 max-h-40 overflow-y-auto border rounded-lg divide-y">
                  {myStudents.map(s => {
                    const selected = (value.studentEmails || []).includes(s.email);
                    return (
                      <button
                        key={s.email}
                        type="button"
                        onClick={() => toggleStudent(s)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${selected ? 'bg-violet-50 text-violet-700 font-medium' : 'hover:bg-slate-50 text-slate-700'}`}
                      >
                        {selected ? '✓ ' : ''}{s.name}
                      </button>
                    );
                  })}
                  {myStudents.length === 0 && (
                    <p className="px-3 py-3 text-sm text-slate-400">No students found in this class.</p>
                  )}
                </div>
              )}
              {(value.studentEmails || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(value.studentNames || []).map((name, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 text-xs">
                      {name}
                      <button onClick={() => toggleStudent({ email: value.studentEmails[i], name })}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary badge */}
      {scopeType === 'SCHOOL' && (
        <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          📢 This will be visible to <strong>everyone</strong> in the school (admin only)
        </p>
      )}
    </div>
  );
}