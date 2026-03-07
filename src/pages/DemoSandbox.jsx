import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Award, BookOpen, Bell, CheckCircle2, Users, 
  BarChart3, Sparkles, ArrowLeft, Send, Plus, Trash2,
  Star, GraduationCap, Settings, TrendingUp, Zap, Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

// --- Dummy Data ---
const dummyStudents = [
  { id: 1, name: 'Sarah Johnson', grade: 'Year 10', avatar: 'S', points: 142, blockwards: 3 },
  { id: 2, name: 'James Okafor', grade: 'Year 10', avatar: 'J', points: 98, blockwards: 2 },
  { id: 3, name: 'Layla Hassan', grade: 'Year 11', avatar: 'L', points: 210, blockwards: 5 },
  { id: 4, name: 'Tom Riley', grade: 'Year 9', avatar: 'T', points: 55, blockwards: 1 },
];

const awardTypes = ['Academic Excellence', 'Leadership Award', 'Sports Achievement', 'Community Hero', 'Creative Arts'];

const dummyBlockwards = [
  { id: 1, title: 'Academic Excellence', student: 'Sarah Johnson', category: 'academic', hash: '0x7f3a...9c2b', verified: true },
  { id: 2, title: 'Leadership Award', student: 'James Okafor', category: 'leadership', hash: '0x4f7c...3a9e', verified: true },
  { id: 3, title: 'Sports Achievement', student: 'Layla Hassan', category: 'sports', hash: '0x9b1e...7d4c', verified: true },
];

const dummyAnnouncements = [
  { id: 1, title: 'End of Term Assembly', body: 'Please be reminded that the end of term assembly will be held in the main hall on Friday at 9am.', priority: 'important', sent: true },
  { id: 2, title: 'Parent Evening Next Week', body: 'Parent-teacher evening is scheduled for Thursday. Booking links have been sent via email.', priority: 'normal', sent: true },
];

// --- Teacher View ---
function TeacherView() {
  const [tab, setTab] = useState('issue');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedAward, setSelectedAward] = useState('');
  const [minting, setMinting] = useState(false);
  const [issued, setIssued] = useState([...dummyBlockwards]);
  const [toast, setToast] = useState(null);
  const [announcements, setAnnouncements] = useState([...dummyAnnouncements]);
  const [newAnn, setNewAnn] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleIssue = () => {
    if (!selectedStudent || !selectedAward) return;
    setMinting(true);
    setTimeout(() => {
      const newBW = {
        id: Date.now(),
        title: selectedAward,
        student: selectedStudent.name,
        category: 'academic',
        hash: '0x' + Math.random().toString(16).slice(2, 8) + '...' + Math.random().toString(16).slice(2, 6),
        verified: true,
      };
      setIssued(prev => [newBW, ...prev]);
      setMinting(false);
      setSelectedStudent(null);
      setSelectedAward('');
      showToast(`🎉 BlockWard "${selectedAward}" issued to ${selectedStudent.name}!`);
    }, 2000);
  };

  const sendAnnouncement = () => {
    if (!newAnn.trim()) return;
    setAnnouncements(prev => [{ id: Date.now(), title: newAnn, body: 'Sent by demo teacher.', priority: 'normal', sent: true }, ...prev]);
    setNewAnn('');
    showToast('📢 Announcement sent to all students!');
  };

  return (
    <div>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-medium">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-2xl">
        {[['issue', '🏆 Issue BlockWard'], ['announcements', '📢 Announcements'], ['class', '📚 My Class']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === key ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'issue' && (
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900">Issue a BlockWard NFT</h3>
          <div className="grid grid-cols-2 gap-3">
            {dummyStudents.map(s => (
              <button key={s.id} onClick={() => setSelectedStudent(s)}
                className={`p-3 rounded-2xl border-2 text-left transition-all ${selectedStudent?.id === s.id ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white hover:border-violet-300'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">{s.avatar}</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.grade}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">{s.blockwards} BlockWards · {s.points} pts</p>
              </button>
            ))}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Select Award Type</p>
            <div className="flex flex-wrap gap-2">
              {awardTypes.map(a => (
                <button key={a} onClick={() => setSelectedAward(a)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedAward === a ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600 hover:border-violet-400'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleIssue} disabled={!selectedStudent || !selectedAward || minting}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 py-6 text-base">
            {minting ? (
              <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 animate-spin" /> Minting on Blockchain...</span>
            ) : (
              <span className="flex items-center gap-2"><Award className="h-4 w-4" /> Issue BlockWard NFT</span>
            )}
          </Button>

          {/* Recent issued */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">Recently Issued</p>
            <div className="space-y-2">
              {issued.slice(0, 4).map(bw => (
                <div key={bw.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{bw.title}</p>
                    <p className="text-xs text-slate-500">{bw.student} · {bw.hash}</p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium shrink-0">On-Chain ✓</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'announcements' && (
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900">Send an Announcement</h3>
          <div className="flex gap-2">
            <input value={newAnn} onChange={e => setNewAnn(e.target.value)}
              placeholder="Type your announcement..."
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
            <Button onClick={sendAnnouncement} className="bg-violet-600 hover:bg-violet-700 px-4">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.id} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="h-4 w-4 text-violet-500" />
                  <p className="font-semibold text-slate-900 text-sm">{a.title}</p>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${a.priority === 'important' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{a.priority}</span>
                </div>
                <p className="text-xs text-slate-500">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'class' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-violet-50 border border-violet-200 flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-violet-600" />
            <div>
              <p className="font-bold text-slate-900">Year 10 Mathematics</p>
              <p className="text-xs text-slate-500">Join Code: <span className="font-mono font-bold text-violet-600">MATH10</span></p>
            </div>
          </div>
          <div className="space-y-2">
            {dummyStudents.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">{s.avatar}</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.grade}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-violet-700">{s.points} pts</p>
                  <p className="text-xs text-slate-400">{s.blockwards} BlockWards</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Admin View ---
function AdminView() {
  const [tab, setTab] = useState('overview');
  const [users, setUsers] = useState([
    { id: 1, name: 'Mrs. Ahmed', role: 'teacher', status: 'active' },
    { id: 2, name: 'Mr. Patel', role: 'teacher', status: 'active' },
    { id: 3, name: 'Sarah Johnson', role: 'student', status: 'active' },
    { id: 4, name: 'James Okafor', role: 'student', status: 'active' },
    { id: 5, name: 'Tom Riley', role: 'student', status: 'suspended' },
  ]);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const toggleStatus = (id) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' } : u));
    showToast('User status updated.');
  };

  const stats = [
    { label: 'Total Students', value: 4, icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Teachers', value: 2, icon: BookOpen, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'BlockWards Issued', value: 11, icon: Award, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Avg. Points', value: 126, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <div>
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-medium">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-2xl">
        {[['overview', '📊 Overview'], ['users', '👥 Manage Users'], ['school', '🏫 School Settings']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === key ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s, i) => (
              <div key={i} className={`p-4 rounded-2xl ${s.bg} flex items-center gap-3`}>
                <div className={`h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-100">
            <p className="font-semibold text-slate-900 mb-3 text-sm">Recent Activity</p>
            {[
              { text: 'Mrs. Ahmed issued "Academic Excellence" to Sarah J.', time: '2m ago' },
              { text: 'New student Tom Riley joined Year 9.', time: '15m ago' },
              { text: 'Parent Evening announcement sent to all.', time: '1h ago' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 py-2 border-b border-slate-50 last:border-0">
                <div className="h-2 w-2 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                <p className="text-sm text-slate-600 flex-1">{item.text}</p>
                <p className="text-xs text-slate-400 shrink-0">{item.time}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">All Users — click status to toggle</p>
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-sm font-bold shrink-0">{u.name[0]}</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{u.name}</p>
                <p className="text-xs text-slate-500 capitalize">{u.role}</p>
              </div>
              <button onClick={() => toggleStatus(u.id)}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${u.status === 'active' ? 'bg-green-100 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'bg-red-100 text-red-700 border-red-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200'}`}>
                {u.status === 'active' ? 'Active ✓' : 'Suspended'}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'school' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-900">St. Mary's Academy</p>
                <p className="text-xs text-slate-500">School Code: <span className="font-mono text-rose-600 font-bold">STMARY</span></p>
              </div>
            </div>
            {[
              { label: 'Student Join Code', value: 'STU-2026' },
              { label: 'Teacher Join Code', value: 'TCH-ADMIN' },
              { label: 'Blockchain Network', value: 'Ethereum Sepolia' },
              { label: 'Smart Contract', value: '0xABc1...9F3d' },
            ].map((item, i) => (
              <div key={i} className="flex justify-between py-2.5 border-b border-slate-50 last:border-0">
                <span className="text-sm text-slate-500">{item.label}</span>
                <span className="text-sm font-mono font-semibold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">School settings and blockchain contract are locked in sandbox mode. In the real app, admins can configure everything here.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Student View ---
function StudentView() {
  const [tab, setTab] = useState('portfolio');
  const [blockwards, setBlockwards] = useState([...dummyBlockwards.map(b => ({ ...b, student: 'Sarah Johnson' }))]);
  const [sendingTo, setSendingTo] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const shareBlockward = (bw) => {
    showToast(`🔗 BlockWard link copied! Share your "${bw.title}" achievement.`);
  };

  const myPoints = 142;
  const recentPoints = [
    { label: 'Algebra Test - Top Score', pts: '+20', type: 'achievement' },
    { label: 'Class Participation', pts: '+10', type: 'achievement' },
    { label: 'Late Submission', pts: '-5', type: 'behaviour' },
    { label: 'Science Project Excellence', pts: '+30', type: 'achievement' },
  ];

  const categoryColors = {
    academic: 'from-violet-500 to-indigo-500',
    leadership: 'from-blue-500 to-cyan-500',
    sports: 'from-green-500 to-teal-500',
    community: 'from-amber-500 to-orange-500',
  };

  return (
    <div>
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-medium">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-2xl">
        {[['portfolio', '🏆 My BlockWards'], ['points', '⭐ My Points'], ['timetable', '📅 Timetable']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === key ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'portfolio' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center font-bold text-xl">S</div>
              <div>
                <p className="font-bold text-lg">Sarah Johnson</p>
                <p className="text-sm text-white/70">Year 11 · Student</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[['3', 'BlockWards'], ['142', 'Points'], ['On-Chain', 'Portfolio']].map(([v, l]) => (
                <div key={l} className="text-center bg-white/10 rounded-xl py-2">
                  <p className="font-bold">{v}</p>
                  <p className="text-xs text-white/70">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-700">My Achievement NFTs</p>
          {blockwards.map(bw => (
            <div key={bw.id} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${categoryColors[bw.category] || 'from-violet-500 to-indigo-500'} flex items-center justify-center`}>
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 text-sm">{bw.title}</p>
                  <p className="text-xs text-slate-500 font-mono">{bw.hash}</p>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">On-Chain ✓</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => shareBlockward(bw)} className="w-full text-xs">
                Share to University Portfolio →
              </Button>
            </div>
          ))}
        </div>
      )}

      {tab === 'points' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white text-center">
            <p className="text-5xl font-extrabold">{myPoints}</p>
            <p className="text-white/80 mt-1">Total Achievement Points</p>
          </div>
          <p className="text-sm font-semibold text-slate-700">Recent Activity</p>
          <div className="space-y-2">
            {recentPoints.map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${p.type === 'achievement' ? 'bg-green-100' : 'bg-red-100'}`}>
                  <Star className={`h-4 w-4 ${p.type === 'achievement' ? 'text-green-600' : 'text-red-600'}`} />
                </div>
                <p className="text-sm text-slate-700 flex-1">{p.label}</p>
                <span className={`text-sm font-bold ${p.pts.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>{p.pts}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'timetable' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">Today's Schedule — Monday</p>
          {[
            { time: '9:00 – 10:00', subject: 'Mathematics', teacher: 'Mrs. Ahmed', room: 'B12' },
            { time: '10:15 – 11:15', subject: 'English Literature', teacher: 'Mr. Patel', room: 'A3' },
            { time: '11:30 – 12:30', subject: 'Science', teacher: 'Dr. Kim', room: 'Lab 2' },
            { time: '13:30 – 14:30', subject: 'History', teacher: 'Ms. Torres', room: 'C7' },
          ].map((lesson, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100">
              <div className="text-xs font-mono text-slate-400 w-24 shrink-0">{lesson.time}</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{lesson.subject}</p>
                <p className="text-xs text-slate-500">{lesson.teacher}</p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-mono">{lesson.room}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Page ---
export default function DemoSandbox() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialRole = urlParams.get('role') || 'teacher';
  const [role, setRole] = useState(initialRole);

  const roles = [
    { key: 'teacher', label: '👩‍🏫 Teacher', color: 'from-violet-600 to-indigo-600', bg: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-700' },
    { key: 'admin', label: '🛡️ Admin', color: 'from-rose-600 to-orange-600', bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700' },
    { key: 'student', label: '🎓 Student', color: 'from-blue-600 to-cyan-600', bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' },
  ];

  const activeRole = roles.find(r => r.key === role);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl('Home')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-900">Demo Sandbox</h1>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Demo Data</span>
            </div>
            <p className="text-xs text-slate-500">Interactive preview — no real data is saved</p>
          </div>
        </div>
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
          <Shield className="h-5 w-5 text-white" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Role Switcher */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Switch Role</p>
          <div className="flex gap-2 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm">
            {roles.map(r => (
              <button key={r.key} onClick={() => setRole(r.key)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${role === r.key ? `bg-gradient-to-r ${r.color} text-white shadow-md` : 'text-slate-500 hover:text-slate-700'}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Role Context Banner */}
        <div className={`mb-6 p-4 rounded-2xl ${activeRole.bg} border ${activeRole.border} flex items-center gap-3`}>
          <Zap className={`h-5 w-5 ${activeRole.text} shrink-0`} />
          <div>
            <p className={`text-sm font-bold ${activeRole.text}`}>
              You're logged in as: Demo {role.charAt(0).toUpperCase() + role.slice(1)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {role === 'teacher' && 'Issue BlockWard NFTs, send announcements, manage your class.'}
              {role === 'admin' && 'Manage users, view analytics, configure school settings.'}
              {role === 'student' && 'View your BlockWard portfolio, points, and timetable.'}
            </p>
          </div>
        </div>

        {/* View Content */}
        <AnimatePresence mode="wait">
          <motion.div key={role} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {role === 'teacher' && <TeacherView />}
            {role === 'admin' && <AdminView />}
            {role === 'student' && <StudentView />}
          </motion.div>
        </AnimatePresence>

        {/* Sign Up CTA */}
        <div className="mt-8 p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white text-center">
          <Sparkles className="h-6 w-6 text-violet-400 mx-auto mb-2" />
          <p className="font-bold mb-1">Ready for the real thing?</p>
          <p className="text-sm text-slate-400 mb-4">Set up your school in minutes — no credit card required.</p>
          <Link to={createPageUrl('Onboarding')}
            className="inline-block bg-gradient-to-r from-violet-500 to-indigo-500 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:from-violet-600 hover:to-indigo-600 transition-all">
            Get Started Free →
          </Link>
        </div>
      </div>
    </div>
  );
}