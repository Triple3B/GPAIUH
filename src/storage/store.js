const STORAGE_KEY = 'iuh-gradetrack-v1';

export function createDemoData() {
  return {
    schemaVersion: 1,
    profile: { name: 'Sinh viên IUH', cohort: 'K22', goalGpa: 3.6, semester: 'HK1 2026–2027' },
    isDemo: true,
    courses: [
      {
        id: 'demo-math', semester: 'HK1 2026–2027', code: 'MATH101', name: 'Toán cao cấp 1', credits: 3, type: 'theory', grading: 'graded',
        assessment: { regularity: 8, midterm: 7, finalExam: null, practiceScores: [] },
      },
      {
        id: 'demo-physics', semester: 'HK1 2026–2027', code: 'PHYS101', name: 'Vật lý đại cương', credits: 3, type: 'theory', grading: 'graded',
        assessment: { regularity: 8, midterm: 8, finalExam: 9, practiceScores: [] },
      },
      {
        id: 'demo-philosophy', semester: 'HK1 2026–2027', code: 'PHIL101', name: 'Triết học Mác – Lênin', credits: 2, type: 'theory', grading: 'graded',
        assessment: { regularity: 9, midterm: 8.5, finalExam: 8, practiceScores: [] },
      },
      {
        id: 'demo-linux', semester: 'HK1 2026–2027', code: 'OS101', name: 'Hệ điều hành Linux', credits: 3, type: 'practice', grading: 'graded',
        assessment: { practiceScores: [8, 8.5, 9, 8, 8.5] },
      },
      {
        id: 'demo-programming', semester: 'HK1 2026–2027', code: 'PRG101', name: 'Nhập môn lập trình', credits: 3, type: 'theory', grading: 'graded',
        assessment: { regularity: 7.5, midterm: 7, finalExam: null, practiceScores: [] },
      },
    ],
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDemoData();
    const parsed = JSON.parse(raw);
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.courses)) return createDemoData();
    return { ...parsed, courses: parsed.courses.map((course) => ({ ...course, semester: course.semester || parsed.profile?.semester || 'Học kỳ hiện tại' })) };
  } catch {
    return createDemoData();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, isDemo: false }));
    return true;
  } catch {
    return false;
  }
}

export function exportState(state) {
  const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'iuh-gradetrack-backup.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importState(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.courses) || !parsed.profile) {
    throw new Error('Tệp sao lưu không đúng định dạng IUH GradeTrack.');
  }
  return { ...parsed, isDemo: false };
}
