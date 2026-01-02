// Mock data for BlockWards feature

export const mockTeacher = {
  id: 'teacher-1',
  role: 'teacher',
  name: 'Ms. Johnson',
  schoolId: 'school-1'
};

export const mockStudent = {
  id: 'student-1',
  role: 'student',
  name: 'Alex Smith',
  schoolId: 'school-1'
};

export const mockStudents = [
  { id: '1', name: 'Alex Smith', class: 'Year 9A', avatarUrl: null },
  { id: '2', name: 'Emma Davis', class: 'Year 9A', avatarUrl: null },
  { id: '3', name: 'James Wilson', class: 'Year 9B', avatarUrl: null },
  { id: '4', name: 'Sophia Brown', class: 'Year 9B', avatarUrl: null },
  { id: '5', name: 'Oliver Taylor', class: 'Year 10A', avatarUrl: null },
  { id: '6', name: 'Isabella Martin', class: 'Year 10A', avatarUrl: null },
];

export const blockWardCategories = [
  'Leadership',
  'Teamwork',
  'Creativity',
  'Attendance',
  'Academic Excellence',
  'Community Service',
  'Innovation',
  'Perseverance'
];

export const blockWardRarities = ['Common', 'Rare', 'Legendary'];

export const mockTemplates = [
  {
    id: 'template-1',
    title: 'Perfect Attendance',
    icon: '📅',
    category: 'Attendance',
    description: 'Awarded for maintaining perfect attendance throughout the term',
    rarity: 'Common'
  },
  {
    id: 'template-2',
    title: 'Team Player',
    icon: '🤝',
    category: 'Teamwork',
    description: 'Recognized for exceptional collaboration and team spirit',
    rarity: 'Common'
  },
  {
    id: 'template-3',
    title: 'Creative Genius',
    icon: '🎨',
    category: 'Creativity',
    description: 'Outstanding creative thinking and original ideas',
    rarity: 'Rare'
  },
  {
    id: 'template-4',
    title: 'Class Leader',
    icon: '⭐',
    category: 'Leadership',
    description: 'Demonstrated exceptional leadership qualities',
    rarity: 'Rare'
  },
  {
    id: 'template-5',
    title: 'Top Scholar',
    icon: '📚',
    category: 'Academic Excellence',
    description: 'Achieved outstanding academic results',
    rarity: 'Legendary'
  },
  {
    id: 'template-6',
    title: 'Community Champion',
    icon: '🌟',
    category: 'Community Service',
    description: 'Made significant contributions to the community',
    rarity: 'Rare'
  }
];

export const mockIssuedBlockWards = [
  {
    id: 'issued-1',
    studentId: '1',
    studentName: 'Alex Smith',
    title: 'Perfect Attendance',
    description: 'Maintained perfect attendance for Term 1',
    category: 'Attendance',
    rarity: 'Common',
    icon: '📅',
    issuedAt: new Date(Date.now() - 86400000).toISOString(),
    issuedBy: 'Ms. Johnson',
    status: 'minted'
  },
  {
    id: 'issued-2',
    studentId: '2',
    studentName: 'Emma Davis',
    title: 'Team Player',
    description: 'Excellent collaboration in group projects',
    category: 'Teamwork',
    rarity: 'Common',
    icon: '🤝',
    issuedAt: new Date(Date.now() - 172800000).toISOString(),
    issuedBy: 'Ms. Johnson',
    status: 'minted'
  },
  {
    id: 'issued-3',
    studentId: '3',
    studentName: 'James Wilson',
    title: 'Creative Genius',
    description: 'Innovative solution in science fair',
    category: 'Creativity',
    rarity: 'Rare',
    icon: '🎨',
    issuedAt: new Date(Date.now() - 259200000).toISOString(),
    issuedBy: 'Ms. Johnson',
    status: 'pending'
  }
];

export const mockStudentBlockWards = [
  {
    id: 'issued-1',
    title: 'Perfect Attendance',
    description: 'Maintained perfect attendance for Term 1',
    category: 'Attendance',
    rarity: 'Common',
    icon: '📅',
    issuedAt: new Date(Date.now() - 86400000).toISOString(),
    issuedBy: 'Ms. Johnson',
    status: 'minted'
  },
  {
    id: 'issued-4',
    title: 'Class Leader',
    description: 'Led class council with dedication',
    category: 'Leadership',
    rarity: 'Rare',
    icon: '⭐',
    issuedAt: new Date(Date.now() - 604800000).toISOString(),
    issuedBy: 'Mr. Thompson',
    status: 'minted'
  }
];

export const mockVault = {
  studentId: 'student-1',
  status: 'active',
  publicAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5',
  createdAt: new Date('2024-09-01').toISOString()
};

export const mockActivityTimeline = [
  {
    id: 'activity-1',
    action: 'issued',
    blockWardTitle: 'Perfect Attendance',
    studentName: 'Alex Smith',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    status: 'minted'
  },
  {
    id: 'activity-2',
    action: 'issued',
    blockWardTitle: 'Team Player',
    studentName: 'Emma Davis',
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    status: 'minted'
  },
  {
    id: 'activity-3',
    action: 'issued',
    blockWardTitle: 'Creative Genius',
    studentName: 'James Wilson',
    timestamp: new Date(Date.now() - 259200000).toISOString(),
    status: 'pending'
  }
];

// Mock API functions
export const api = {
  async getTeacherIssuedBlockWards() {
    await new Promise(resolve => setTimeout(resolve, 800));
    return mockIssuedBlockWards;
  },

  async getStudents() {
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockStudents;
  },

  async issueBlockWard(payload) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Simulate 90% success rate
    if (Math.random() > 0.9) {
      throw new Error('Failed to issue BlockWard');
    }
    return {
      id: 'issued-' + Date.now(),
      ...payload,
      status: 'minted',
      issuedAt: new Date().toISOString()
    };
  },

  async getStudentBlockWards() {
    await new Promise(resolve => setTimeout(resolve, 800));
    return mockStudentBlockWards;
  },

  async getStudentVault() {
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockVault;
  },

  async getActivityTimeline() {
    await new Promise(resolve => setTimeout(resolve, 600));
    return mockActivityTimeline;
  }
};