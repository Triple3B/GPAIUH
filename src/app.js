import {
  GRADE_SCALE,
  calculateCourse,
  getPracticeColumnCount,
  calculateGpa,
  getCourseStatusLabel,
  getAcademicClassification,
  findMinimumFinalScore,
  requiredGpaForRemainingCourses,
} from './domain/grade-engine.js';
import { loadState, saveState, exportState, importState, createDemoData } from './storage/store.js';

let state = loadState();
let activeView = 'overview';
let modalCourseId = null;
let plannerSelections = {};
let searchTerm = '';
let toastHandle = null;

function getActiveCourses() {
  const term = state.profile.semester || 'Học kỳ hiện tại';
  return state.courses.filter((course) => (course.semester || term) === term);
}

function getDashboardGpa() {
  const current = calculateGpa(getActiveCourses());
  const all = calculateGpa(state.courses);
  return { ...current, cumulativeGpa: all.cumulativeGpa, cumulativeCredits: all.cumulativeCredits, creditsEarned: all.creditsEarned, allCreditsRegistered: all.creditsRegistered };
}

function getRepeatedCourseCodes() {
  const counts = new Map();
  state.courses.forEach((course) => {
    const code = String(course.code || '').trim().toUpperCase();
    if (!code) return;
    counts.set(code, (counts.get(code) || 0) + 1);
  });
  return [...counts.entries()].filter(([, count]) => count > 1).map(([code]) => code);
}

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const app = $('#app');
const modalRoot = $('#modal-root');
const toastRoot = $('#toast-root');

const pageInfo = {
  overview: ['Tổng quan học tập', 'Bức tranh tổng thể về kết quả học tập của bạn.'],
  courses: ['Quản lý học phần', 'Nhập điểm, theo dõi trạng thái và quản lý từng môn học.'],
  planner: ['Mô phỏng mục tiêu GPA', 'Tính ngược điểm cần đạt để chạm mục tiêu học kỳ.'],
  analytics: ['Phân tích học tập', 'Theo dõi tín chỉ, kết quả môn học và các tín hiệu học vụ.'],
  settings: ['Dữ liệu & thiết lập', 'Quản lý mục tiêu, học kỳ và bản sao lưu dữ liệu.'],
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function number(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function resultFor(course) {
  return calculateCourse(course);
}

function scorePill(course) {
  const result = resultFor(course);
  if (result.status !== 'complete') return '<span class="grade-pill">—</span>';
  if (course.grading === 'passfail') return `<span class="grade-pill ${result.passed ? 'good' : 'bad'}">${result.passFail}</span>`;
  const klass = result.score10 >= 5 ? 'good' : 'bad';
  return `<span class="grade-pill ${klass}">${esc(result.grade?.letter ?? 'F')}</span>`;
}

function statusClass(course) {
  const result = resultFor(course);
  if (result.status === 'complete') return course.grading === 'passfail' ? (result.passed ? 'good' : 'bad') : (result.score10 >= 4 ? 'good' : 'bad');
  if (['blocked', 'ineligible', 'configuration'].includes(result.status)) return 'warn';
  return '';
}

function gpaString(value) {
  return value === null ? '—' : value.toFixed(2);
}

function renderShell() {
  const [title, subtitle] = pageInfo[activeView];
  const gpa = getDashboardGpa();
  const terms = [...new Set([state.profile.semester, ...state.courses.map((course) => course.semester).filter(Boolean)])].filter(Boolean);
  const currentName = esc(state.profile.name || 'Sinh viên IUH');
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="brand">
          <div class="brand-mark">G</div>
          <div><div class="brand-name">IUH GRADETRACK</div><div class="brand-tag">ACADEMIC CONTROL CENTER</div></div>
        </div>
        <div class="nav-label">WORKSPACE</div>
        <nav class="nav-list" aria-label="Điều hướng chính">
          <button class="nav-btn ${activeView === 'overview' ? 'active' : ''}" data-view="overview"><span class="nav-icon">▦</span> Tổng quan</button>
          <button class="nav-btn ${activeView === 'courses' ? 'active' : ''}" data-view="courses"><span class="nav-icon">▤</span> Học phần của tôi</button>
          <button class="nav-btn ${activeView === 'planner' ? 'active' : ''}" data-view="planner"><span class="nav-icon">⌁</span> Mô phỏng GPA</button>
          <button class="nav-btn ${activeView === 'analytics' ? 'active' : ''}" data-view="analytics"><span class="nav-icon">▥</span> Phân tích học tập</button>
        </nav>
        <div class="nav-label" style="margin-top:25px">SYSTEM</div>
        <nav class="nav-list">
          <button class="nav-btn ${activeView === 'settings' ? 'active' : ''}" data-view="settings"><span class="nav-icon">⚙</span> Dữ liệu & thiết lập</button>
        </nav>
        <div class="sidebar-bottom">
          <div class="sidebar-note"><strong>Quy chế IUH · K22</strong>Máy tính đang dùng bộ quy tắc theo tài liệu nghiên cứu K22/2025 được cung cấp. Kiểm tra lại văn bản gốc trước khi dùng kết quả cho quyết định chính thức.</div>
          <div class="profile-mini"><div class="avatar">IU</div><div><strong>${currentName}</strong><small>${esc(state.profile.cohort || 'K22')} · ${esc(state.profile.semester || '')}</small></div></div>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div style="display:flex;align-items:center;gap:12px"><button class="icon-button mobile-menu" id="mobile-menu" aria-label="Mở menu">☰</button><div class="breadcrumb">IUH GradeTrack <span style="padding:0 7px;color:#c0c7d3">/</span> <strong>${title}</strong></div></div>
          <div class="top-actions">
            <select class="term-select" id="semester-select" aria-label="Học kỳ đang xem">${terms.map((term) => `<option value="${esc(term)}" ${term === state.profile.semester ? 'selected' : ''}>${esc(term)}</option>`).join('')}</select>
            <button class="icon-button" id="backup-top" title="Xuất dữ liệu">⇩</button>
          </div>
        </header>
        <div class="page-heading"><div><div class="eyebrow">STUDENT PERFORMANCE SYSTEM</div><h1>${title}</h1><p class="page-subtitle">${subtitle}</p></div>${activeView === 'courses' ? '<button class="btn" id="add-course"><span>＋</span> Thêm học phần</button>' : activeView === 'overview' ? '<button class="btn" id="add-course"><span>＋</span> Thêm học phần</button>' : ''}</div>
        ${state.isDemo ? '<div class="demo-banner"><span>ⓘ</span><span><strong>Đang xem dữ liệu minh họa.</strong> Hãy thay bằng điểm thật của bạn. Dữ liệu này không phải bảng điểm chính thức.</span></div>' : ''}
        ${getRepeatedCourseCodes().length ? `<div class="notice-card" style="margin-bottom:15px"><span class="notice-icon">⚠</span><span><strong>Phát hiện mã học phần lặp:</strong> ${getRepeatedCourseCodes().map(esc).join(', ')}. MVP chưa tự xử lý quy tắc học lại/cải thiện; ĐTBCTL và tín chỉ tích lũy có thể bị đếm trùng. Hãy xác minh và không dùng chỉ số này làm kết luận chính thức.</span></div>` : ''}
        <section id="view-root">${renderView(gpa)}</section>
      </main>
    </div>`;
}

function renderView(gpa = getDashboardGpa()) {
  if (activeView === 'overview') return renderOverview(gpa);
  if (activeView === 'courses') return renderCourses();
  if (activeView === 'planner') return renderPlanner();
  if (activeView === 'analytics') return renderAnalytics(gpa);
  return renderSettings(gpa);
}

function renderOverview(gpa) {
  const currentGpa = gpa.semesterGpa;
  const target = Number(state.profile.goalGpa) || 3.6;
  const progress = currentGpa === null ? 0 : Math.max(0, Math.min(100, (currentGpa / target) * 100));
  const active = getActiveCourses();
  const remaining = active.filter((course) => resultFor(course).status !== 'complete' && course.grading === 'graded').length;
  const recent = active.slice(0, 5);
  return `
    <div class="stats-grid">
      <article class="stat-card"><div class="stat-top"><span>ĐTBHL học kỳ · Thang 4</span><span class="stat-icon">◈</span></div><div class="stat-value">${gpaString(currentGpa)}<span style="font-size:12px;color:#a0a9b8;font-weight:600"> / 4.00</span></div><div class="stat-foot">${currentGpa === null ? 'Chưa có học phần đủ điểm' : `Xếp loại ${getAcademicClassification(currentGpa)} · tạm tính trên ${gpa.semesterCredits} TC có điểm`}</div></article>
      <article class="stat-card"><div class="stat-top"><span>ĐTBCTL · Thang 4</span><span class="stat-icon" style="background:#e5f8f3;color:#12a98c">◎</span></div><div class="stat-value">${gpaString(gpa.cumulativeGpa)}<span style="font-size:12px;color:#a0a9b8;font-weight:600"> / 4.00</span></div><div class="stat-foot">${gpa.cumulativeCredits} tín chỉ đạt trong dữ liệu đã nhập</div></article>
      <article class="stat-card"><div class="stat-top"><span>Tín chỉ đã đạt</span><span class="stat-icon" style="background:#fff5df;color:#d98b1e">▥</span></div><div class="stat-value">${gpa.creditsEarned}<span style="font-size:12px;color:#a0a9b8;font-weight:600"> / ${gpa.allCreditsRegistered}</span></div><div class="stat-foot">Bao gồm học phần đạt P và miễn học</div></article>
      <article class="stat-card"><div class="stat-top"><span>Học phần cần cập nhật</span><span class="stat-icon" style="background:#fff0f2;color:#d64f63">◷</span></div><div class="stat-value">${remaining}</div><div class="stat-foot">Chưa đủ dữ liệu để chốt điểm</div></article>
    </div>
    <div class="content-grid">
      <div class="panel">
        <div class="panel-header"><div><div class="panel-title">Học phần gần đây</div><div class="panel-caption">${esc(state.profile.semester || 'Học kỳ hiện tại')} · Tình trạng điểm của các môn</div></div><button class="text-link" data-view="courses">Xem tất cả →</button></div>
        <div class="panel-body"><div class="table-wrap"><table><thead><tr><th>Học phần</th><th>TC</th><th>Điểm 10</th><th>Điểm chữ</th><th>Trạng thái</th></tr></thead><tbody>
          ${recent.length ? recent.map((course) => {
            const r = resultFor(course);
            return `<tr><td><div class="course-name">${esc(course.name)}</div><div class="course-code">${esc(course.code || 'Chưa có mã')}</div></td><td>${course.credits}</td><td><strong style="color:#27334a">${r.score10 === null ? '—' : number(r.score10)}</strong></td><td>${scorePill(course)}</td><td><span class="status ${statusClass(course)}">${esc(getCourseStatusLabel(course))}</span></td></tr>`;
          }).join('') : '<tr><td colspan="5"><div class="empty-state">Chưa có học phần. Thêm môn đầu tiên để bắt đầu.</div></td></tr>'}
        </tbody></table></div></div>
      </div>
      <div>
        <div class="goal-panel"><div class="goal-label">Mục tiêu GPA học kỳ</div><div class="goal-number-row"><span class="goal-number">${gpaString(currentGpa)}</span><span class="goal-denom">/ ${target.toFixed(2)}</span></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><div class="goal-meta"><span>Tiến độ mục tiêu</span><strong>${progress.toFixed(0)}%</strong></div><div class="goal-hint">${currentGpa === null ? 'Nhập điểm học phần để hệ thống đánh giá tiến độ.' : currentGpa >= target ? (remaining > 0 ? `<strong>Đã chạm ngưỡng tạm tính.</strong> Có ${remaining} học phần chưa có kết quả; chưa thể kết luận mục tiêu học kỳ đã hoàn thành.` : '<strong>Đã đạt mục tiêu GPA.</strong> Tất cả học phần đã khai báo đều có kết quả.') : `Còn cách mục tiêu ${(target - currentGpa).toFixed(2)} điểm GPA trên dữ liệu đã có. Mở mô phỏng để tính điểm cần đạt ở các môn chưa có kết quả.`}</div></div>
        <div class="quick-actions"><button class="quick-action" data-view="planner"><span>⌁</span> Mô phỏng mục tiêu</button><button class="quick-action" data-view="analytics"><span>▥</span> Xem phân tích</button></div>
        <div class="notice-card"><span class="notice-icon">ⓘ</span><span><strong>Độ tin cậy dữ liệu</strong><br/>GPA chỉ chính xác trong phạm vi môn học và điểm bạn đã nhập. ĐTBCTL cần bổ sung đầy đủ lịch sử học tập từ các học kỳ trước.</span></div>
      </div>
    </div>
    <p class="footnote">Ghi chú: ĐTBHL học kỳ và ĐTBCTL được tách riêng. Các học phần chưa đủ điểm tạm thời chưa tham gia phép tính; đây là số liệu theo dữ liệu bạn đã nhập, không thay thế kết quả trên hệ thống IUH.</p>`;
}

function renderCourses() {
  const active = getActiveCourses();
  const filtered = active.filter((course) => `${course.name} ${course.code}`.toLowerCase().includes(searchTerm.toLowerCase()));
  const cards = filtered.map((course) => {
    const result = resultFor(course);
    const typeName = ({ theory: 'Lý thuyết', practice: 'Thực hành', integrated: 'Tích hợp', internship: 'Thực tập / khóa luận' })[course.type] || 'Học phần';
    return `<article class="course-card"><div class="course-card-top"><div><h3>${esc(course.name)}</h3><p>${esc(course.code || 'Chưa có mã')} · ${course.credits} tín chỉ</p></div><div class="course-score">${result.score10 === null ? '—' : number(result.score10)}</div></div><div class="course-meta"><span class="meta-chip">${typeName}</span><span class="meta-chip">${course.grading === 'passfail' ? 'Đạt / Không đạt' : course.grading === 'exempt' ? 'Miễn học' : result.grade ? `${result.grade.letter} · ${result.grade.point4.toFixed(1)}/4` : 'Chưa chốt điểm'}</span><span class="status ${statusClass(course)}">${esc(getCourseStatusLabel(course))}</span></div><div class="course-card-actions"><button class="btn small" data-edit-course="${esc(course.id)}">${result.status === 'complete' ? 'Sửa điểm' : 'Nhập / sửa điểm'}</button><button class="btn small secondary" data-delete-course="${esc(course.id)}">Xóa</button></div></article>`;
  }).join('');
  return `<div class="toolbar" style="justify-content:space-between;margin-bottom:14px"><input class="search-input" id="course-search" placeholder="Tìm theo tên hoặc mã học phần…" value="${esc(searchTerm)}"/><div class="toolbar"><span style="color:var(--muted);font-size:10px">${active.length} học phần · ${esc(state.profile.semester || '')}</span></div></div>${cards ? `<div class="course-grid">${cards}</div>` : '<div class="panel"><div class="empty-state"><strong>Không tìm thấy học phần</strong>Thử từ khóa khác hoặc thêm môn học mới.</div></div>'}<p class="footnote">Điểm thành phần được làm tròn theo quy tắc trong tài liệu nghiên cứu đã cung cấp. Loại học phần, số cột điểm và điều kiện đặc biệt được áp dụng riêng cho từng môn.</p>`;
}

function renderPlanner() {
  const active = getActiveCourses();
  const plan = requiredGpaForRemainingCourses(active, Number(state.profile.goalGpa) || 3.6);
  const target = Number(state.profile.goalGpa) || 3.6;
  const pending = active.filter((course) => course.grading === 'graded' && resultFor(course).status === 'pending');
  const blocked = active.filter((course) => course.grading === 'graded' && ['blocked', 'ineligible', 'configuration'].includes(resultFor(course).status));
  const gpa = calculateGpa(active);
  const fixed = active.filter((course) => course.grading === 'graded' && resultFor(course).status === 'complete');
  const totalCredits = active.filter((course) => course.grading === 'graded').reduce((sum, c) => sum + Number(c.credits), 0);
  const fixedCredits = fixed.reduce((sum, c) => sum + Number(c.credits), 0);
  const predicted = pending.reduce((sum, course) => {
    const selected = plannerSelections[course.id];
    const grade = GRADE_SCALE.find((g) => g.letter === selected) || (plan.recommended || (plan.status === 'impossible' ? GRADE_SCALE[0] : GRADE_SCALE[2]));
    return sum + grade.point4 * Number(course.credits);
  }, 0);
  const fixedPoints = fixed.reduce((sum, course) => sum + resultFor(course).grade.point4 * Number(course.credits), 0);
  const projected = plan.status === 'blocked' ? null : totalCredits > 0 && totalCredits > fixedCredits ? (fixedPoints + predicted) / totalCredits : gpa.semesterGpa;
  const message = plan.status === 'blocked'
    ? `Chưa thể mô phỏng đáng tin cậy vì có ${blocked.length} học phần vướng điều kiện hoặc thiếu cấu hình: ${blocked.map((c) => c.name).join(', ')}. Hãy xử lý các điều kiện này trước.`
    : plan.status === 'impossible'
    ? `Mục tiêu ${target.toFixed(2)} hiện không thể đạt bằng các học phần còn lại trong danh sách. Mức GPA trung bình cần thiết là ${number(plan.requiredAverage, 2)}/4, vượt trần 4.00.`
    : plan.status === 'possible'
      ? `Để đạt GPA ${target.toFixed(2)}, các học phần chưa có kết quả cần đạt trung bình tối thiểu khoảng ${number(plan.requiredAverage, 2)}/4. Nếu chia đều mục tiêu, mức gợi ý là ${plan.recommended.letter} (${plan.recommended.point4.toFixed(1)}/4) cho từng môn.`
      : plan.status === 'complete'
        ? `Tất cả học phần có điểm số trong học kỳ đã có kết quả. GPA hiện tại là ${gpaString(plan.fixedGpa)}; đối chiếu với mục tiêu để đánh giá kết quả.`
      : plan.status === 'safe'
        ? 'Các điểm đã có đủ để đạt mục tiêu trong mô hình hiện tại. Những môn còn lại vẫn được tính vào GPA dự phóng.'
        : 'Cần thêm học phần có điểm hoặc học phần chưa có kết quả để mô phỏng.';
  const calloutClass = ['impossible', 'blocked'].includes(plan.status) ? 'impossible' : ['safe', 'complete'].includes(plan.status) ? 'safe' : '';
  return `
    <div class="panel" style="margin-bottom:15px"><div class="panel-header"><div><div class="panel-title">Thiết lập mục tiêu</div><div class="panel-caption">Mục tiêu áp dụng cho GPA học kỳ theo hệ 4</div></div><div class="field" style="width:110px"><input type="number" id="goal-gpa" min="0" max="4" step="0.01" value="${target.toFixed(2)}" aria-label="GPA mục tiêu" /></div></div><div class="panel-body"><div class="planner-callout ${calloutClass}">${esc(message)}</div><div class="planner-summary"><div class="mini-stat"><span>GPA hiện tại · tạm tính</span><strong>${gpaString(gpa.semesterGpa)}</strong></div><div class="mini-stat"><span>GPA dự phóng theo kịch bản</span><strong>${gpaString(projected)}</strong></div><div class="mini-stat"><span>Tín chỉ chưa có điểm</span><strong>${plan.remainingCredits ?? 0}</strong></div></div></div></div>
    <div class="panel"><div class="panel-header"><div><div class="panel-title">Phân bổ mục tiêu theo học phần</div><div class="panel-caption">Chọn mức điểm dự kiến cho từng môn để xem GPA thay đổi.</div></div></div><div class="panel-body">
      ${pending.length ? `<div class="table-wrap"><table><thead><tr><th>Học phần</th><th>TC</th><th>Điểm dự kiến</th><th>Hệ 4</th><th>Trạng thái</th></tr></thead><tbody>${pending.map((course) => {
        const suggested = plannerSelections[course.id] || plan.recommended?.letter || (plan.status === 'impossible' ? 'A+' : 'B+');
        const grade = GRADE_SCALE.find((g) => g.letter === suggested) || GRADE_SCALE[2];
        return `<tr><td><div class="course-name">${esc(course.name)}</div><div class="course-code">${esc(course.code || '')}</div></td><td>${course.credits}</td><td><select class="term-select plan-grade" data-plan-course="${esc(course.id)}" style="padding:7px 8px">${GRADE_SCALE.filter((g) => g.letter !== 'F' || true).map((g) => `<option value="${g.letter}" ${g.letter === suggested ? 'selected' : ''}>${g.letter} · ${g.min10.toFixed(1)}–${g.max10.toFixed(1)}</option>`).join('')}</select></td><td><strong>${grade.point4.toFixed(1)}</strong></td><td><span class="status warn">Dự kiến</span></td></tr>`;
      }).join('')}</tbody></table></div>` : '<div class="empty-state"><strong>Không còn môn đang chờ kết quả</strong>Hãy thêm học phần hoặc nhập thêm môn chưa có điểm để mô phỏng.</div>'}
      ${blocked.length ? `<div class="notice-card"><span class="notice-icon">⚠</span><span><strong>Học phần chưa thể mô phỏng:</strong> ${blocked.map((course) => `${esc(course.name)} — ${esc(getCourseStatusLabel(course))}`).join('; ')}. Hãy cập nhật điểm hoặc xử lý điều kiện trước khi dùng kết quả dự báo.</span></div>` : ''}
      <p class="footnote">Đây là mô phỏng theo điểm chữ quy đổi và số tín chỉ. Nó không dự đoán xác suất đạt điểm, không phân bổ điểm thành phần thay cho giảng viên và không tự thay thế kết quả chính thức.</p>
    </div></div>`;
}

function renderAnalytics(gpa) {
  const active = getActiveCourses();
  const tracked = active.filter((c) => c.grading !== 'exempt');
  const passCount = tracked.filter((c) => { const r = resultFor(c); return r.status === 'complete' && (c.grading === 'passfail' ? r.passed : r.score10 >= 4); }).length;
  const failCount = tracked.filter((c) => { const r = resultFor(c); return r.status === 'complete' && (c.grading === 'passfail' ? r.passFail === 'F' : r.score10 < 4); }).length;
  const pendingCount = tracked.filter((c) => ['pending', 'blocked', 'ineligible', 'configuration'].includes(resultFor(c).status)).length;
  const failPercent = gpa.creditsRegistered ? (gpa.failedCredits / gpa.creditsRegistered) * 100 : 0;
  const sorted = [...active].map((c) => ({ course: c, result: resultFor(c) })).filter((item) => item.result.score10 !== null).sort((a, b) => a.result.score10 - b.result.score10);
  const terms = [...new Set(state.courses.map((course) => course.semester).filter(Boolean))];
  const termGpas = terms.map((term) => ({ term, gpa: calculateGpa(state.courses.filter((course) => course.semester === term)).semesterGpa })).filter((item) => item.gpa !== null);
  return `<div class="stats-grid"><article class="stat-card"><div class="stat-top"><span>Học phần đạt</span><span class="stat-icon" style="background:var(--teal-soft);color:var(--teal)">✓</span></div><div class="stat-value">${passCount}</div><div class="stat-foot">Điểm số từ 4.0 hoặc kết quả P</div></article><article class="stat-card"><div class="stat-top"><span>Học phần không đạt</span><span class="stat-icon" style="background:var(--red-soft);color:var(--red)">!</span></div><div class="stat-value">${failCount}</div><div class="stat-foot">${gpa.failedCredits} tín chỉ không đạt</div></article><article class="stat-card"><div class="stat-top"><span>Đang chờ điểm</span><span class="stat-icon" style="background:var(--amber-soft);color:var(--amber)">◷</span></div><div class="stat-value">${pendingCount}</div><div class="stat-foot">Cần cập nhật thêm dữ liệu</div></article><article class="stat-card"><div class="stat-top"><span>Tỷ lệ TC không đạt</span><span class="stat-icon">%</span></div><div class="stat-value">${failPercent.toFixed(1)}<span style="font-size:12px;color:#a0a9b8">%</span></div><div class="stat-foot">Trên tổng tín chỉ đã khai báo</div></article></div>
    <div class="panel" style="margin-bottom:15px"><div class="panel-header"><div><div class="panel-title">Diễn biến ĐTBHL theo học kỳ</div><div class="panel-caption">Tính từ dữ liệu đã lưu ở từng học kỳ</div></div></div><div class="panel-body"><div class="history-bars">${termGpas.length ? termGpas.map((item) => `<div class="history-row"><span title="${esc(item.term)}">${esc(item.term)}</span><div class="history-track"><div class="history-fill" style="width:${Math.max(0, Math.min(100, item.gpa / 4 * 100))}%"></div></div><strong>${item.gpa.toFixed(2)}</strong></div>`).join('') : '<div class="empty-state">Cần nhập học phần ở nhiều học kỳ để xem xu hướng.</div>'}</div></div></div>
    <div class="section-grid"><div class="panel"><div class="panel-header"><div><div class="panel-title">Phân bố điểm theo học phần</div><div class="panel-caption">Điểm hệ 10 của những môn đã có kết quả</div></div></div><div class="panel-body"><div class="history-bars">${sorted.length ? sorted.map(({ course, result }) => `<div class="history-row"><span title="${esc(course.name)}">${esc(course.name.length > 15 ? `${course.name.slice(0, 15)}…` : course.name)}</span><div class="history-track"><div class="history-fill" style="width:${result.score10 * 10}%"></div></div><strong>${number(result.score10)}</strong></div>`).join('') : '<div class="empty-state">Chưa có dữ liệu điểm để phân tích.</div>'}</div></div></div>
    <div class="panel"><div class="panel-header"><div><div class="panel-title">Theo dõi điều kiện học vụ</div><div class="panel-caption">Tín hiệu tham khảo, không phải kết luận cảnh báo chính thức</div></div></div><div class="panel-body"><div style="font:800 24px Manrope;color:${failPercent > 50 ? 'var(--red)' : 'var(--teal)'}">${failPercent.toFixed(1)}%</div><div class="progress-track" style="background:#eff1f6"><div class="progress-fill" style="width:${Math.min(100, failPercent)}%;background:${failPercent > 50 ? 'var(--red)' : 'var(--teal)'}"></div></div><p style="font-size:10px;color:var(--muted);line-height:1.6">Tài liệu nghiên cứu nêu ngưỡng cảnh báo khi tín chỉ không đạt trong học kỳ vượt quá 50% tín chỉ đăng ký. Chỉ số trên đang dùng các môn đã nhập; chưa đủ để kết luận tình trạng học vụ thực tế.</p><div class="notice-card"><span class="notice-icon">ⓘ</span><span>Để kiểm tra cảnh báo học tập đúng trường hợp, cần nhập đầy đủ học phần, lịch sử nợ tín chỉ và ĐTBHL theo từng năm học.</span></div></div></div></div>`;
}

function renderSettings(gpa) {
  return `<div class="section-grid"><div class="panel"><div class="panel-header"><div><div class="panel-title">Hồ sơ học tập</div><div class="panel-caption">Các thông tin dùng để cá nhân hóa dashboard</div></div></div><div class="panel-body"><div class="form-grid"><div class="field full"><label>Tên hiển thị</label><input id="profile-name" value="${esc(state.profile.name || '')}" maxlength="60" /></div><div class="field"><label>Khóa tuyển sinh</label><input id="profile-cohort" value="${esc(state.profile.cohort || '')}" maxlength="20" /></div><div class="field"><label>Học kỳ đang theo dõi</label><input id="profile-semester" value="${esc(state.profile.semester || '')}" maxlength="40" /></div><div class="field"><label>GPA mục tiêu (thang 4)</label><input type="number" id="profile-goal" min="0" max="4" step="0.01" value="${Number(state.profile.goalGpa || 3.6).toFixed(2)}" /></div></div><div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn" id="save-profile">Lưu thiết lập</button></div></div></div>
    <div class="panel"><div class="panel-header"><div><div class="panel-title">Sao lưu & khôi phục</div><div class="panel-caption">Dữ liệu được lưu cục bộ trên trình duyệt này</div></div></div><div class="panel-body"><p style="color:var(--muted);font-size:10px;line-height:1.6;margin-top:0">Không cần tài khoản. Dữ liệu không tự đồng bộ sang thiết bị khác. Hãy xuất bản sao lưu định kỳ trước khi xóa dữ liệu trình duyệt.</p><div class="toolbar"><button class="btn" id="export-data">⇩ Xuất bản sao lưu</button><label class="btn secondary" for="import-file">⇧ Nhập bản sao lưu</label><input type="file" id="import-file" accept="application/json,.json" hidden /></div><div class="divider"></div><button class="btn danger" id="reset-demo">Khôi phục dữ liệu minh họa</button><p class="footnote">Khôi phục sẽ thay toàn bộ dữ liệu hiện tại bằng dữ liệu demo ban đầu. Hãy xuất bản sao lưu trước khi thực hiện.</p></div></div></div>
    <div class="panel" style="margin-top:15px"><div class="panel-header"><div><div class="panel-title">Tình trạng dữ liệu hiện tại</div><div class="panel-caption">Tóm tắt kho dữ liệu trong trình duyệt</div></div></div><div class="panel-body"><div class="planner-summary"><div class="mini-stat"><span>Số học phần</span><strong>${state.courses.length}</strong></div><div class="mini-stat"><span>Tín chỉ khai báo toàn bộ</span><strong>${calculateGpa(state.courses).creditsRegistered}</strong></div><div class="mini-stat"><span>Trạng thái lưu</span><strong style="font-size:14px">${state.isDemo ? 'Dữ liệu mẫu' : 'Đã lưu cục bộ'}</strong></div></div></div></div>
    <div class="panel" style="margin-top:15px"><div class="panel-header"><div><div class="panel-title">Tài liệu tham chiếu quy chế</div><div class="panel-caption">Các nguồn được dẫn trong bản nghiên cứu đầu vào</div></div></div><div class="panel-body"><div style="display:grid;gap:9px;font-size:10px"><a href="https://pdt.iuh.edu.vn/quy-che-dao-tao" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-weight:700">Phòng Đào tạo IUH — Quy chế đào tạo ↗</a><a href="https://tqa.iuh.edu.vn/wp-content/uploads/2025/12/Quyet-dinh-so-610-QD-DHCN-ve-viec-ban-hanh-Quy-che-quan-ly-cong-tac-thi-va-danh-gia-ket-qua-hoc-tap..pdf" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-weight:700">Quyết định 610/QĐ-ĐHCN — Quy chế thi và đánh giá ↗</a></div><p class="footnote">Hai nguồn điều chỉnh các phạm vi khác nhau. Các liên kết là tài liệu tham chiếu, không phải xác nhận rằng mọi quy tắc đã được thẩm định pháp lý đầy đủ cho từng học phần K22.</p></div></div>`;
}

function render() {
  renderShell();
}

function toast(message, kind = 'success') {
  clearTimeout(toastHandle);
  toastRoot.innerHTML = `<div class="toast" style="${kind === 'error' ? 'background:#9f3447' : ''}">${esc(message)}</div>`;
  toastHandle = setTimeout(() => { toastRoot.innerHTML = ''; }, 2800);
}

function persist() {
  const ok = saveState(state);
  state.isDemo = false;
  if (!ok) toast('Không thể lưu dữ liệu. Hãy xuất bản sao lưu để tránh mất dữ liệu.', 'error');
  return ok;
}

function addCourseDefaults() {
  return {
    id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    semester: state.profile.semester || 'Học kỳ hiện tại',
    code: '', name: '', credits: 3, type: 'theory', grading: 'graded',
    theoryCredits: 2, practiceCredits: 1, practiceColumnCount: 3,
    assessment: { regularity: null, midterm: null, finalExam: null, practiceScores: [], singleScore: null, passFailResult: 'pending' },
  };
}

function scoreField(label, name, value, help = '') {
  return `<div class="field"><label>${label}</label><input type="number" inputmode="decimal" min="0" max="10" step="0.01" name="${name}" value="${value ?? ''}" placeholder="0.00 – 10.00" /><small>${help}</small></div>`;
}

function modalAssessmentFields(course) {
  const a = course.assessment || {};
  if (course.grading === 'passfail') {
    return `<div class="field full"><label>Kết quả học phần</label><select name="passFailResult"><option value="pending" ${a.passFailResult === 'pending' ? 'selected' : ''}>Chưa có kết quả</option><option value="P" ${a.passFailResult === 'P' ? 'selected' : ''}>P — Đạt</option><option value="F" ${a.passFailResult === 'F' ? 'selected' : ''}>F — Không đạt (học phần không phân mức)</option><option value="I" ${a.passFailResult === 'I' ? 'selected' : ''}>I — Hoãn thi có phép</option><option value="X" ${a.passFailResult === 'X' ? 'selected' : ''}>X — Chưa đủ dữ liệu</option></select><small>Học phần không phân mức không được đưa vào GPA theo tài liệu nghiên cứu.</small></div>`;
  }
  if (course.grading === 'exempt') return '<div class="notice-card"><span class="notice-icon">ⓘ</span><span>Học phần miễn học/công nhận tín chỉ được lưu nhưng không tham gia GPA.</span></div>';
  if (course.type === 'theory') {
    return `<div class="form-grid three">${scoreField('Điểm thường kỳ · 20%', 'regularity', a.regularity)}${scoreField('Điểm giữa kỳ · 30%', 'midterm', a.midterm)}${scoreField('Điểm cuối kỳ · 50%', 'finalExam', a.finalExam, 'Để trống khi chưa thi.')}</div>`;
  }
  if (course.type === 'practice') {
    const count = getPracticeColumnCount(course.credits);
    return `<div class="notice-card" style="margin:0 0 12px"><span class="notice-icon">ⓘ</span><span>${count} cột điểm thực hành theo số tín chỉ đã khai báo.</span></div><div class="form-grid three">${Array.from({ length: count }, (_, i) => scoreField(`Cột điểm ${i + 1}`, `practice-${i}`, a.practiceScores?.[i])) .join('')}</div>`;
  }
  if (course.type === 'integrated') {
    const practiceCredits = Number(course.practiceCredits || 1);
    const theoryCredits = Number(course.theoryCredits || Math.max(1, Number(course.credits) - practiceCredits));
    const count = Number(course.practiceColumnCount || getPracticeColumnCount(practiceCredits));
    return `<div class="form-grid three"><div class="field"><label>Tín chỉ lý thuyết</label><input type="number" name="theoryCredits" min="1" max="20" value="${theoryCredits}" /></div><div class="field"><label>Tín chỉ thực hành</label><input type="number" name="practiceCredits" min="1" max="20" value="${practiceCredits}" /></div><div class="field"><label>Số cột điểm thực hành</label><select name="practiceColumnCount"><option value="3" ${count === 3 ? 'selected' : ''}>3 cột</option><option value="5" ${count === 5 ? 'selected' : ''}>5 cột</option></select></div></div><div class="divider"></div><div class="subheading">Điểm phần lý thuyết</div><div class="form-grid three">${scoreField('Điểm thường kỳ · 20%', 'regularity', a.regularity)}${scoreField('Điểm giữa kỳ · 30%', 'midterm', a.midterm)}${scoreField('Điểm cuối kỳ · 50%', 'finalExam', a.finalExam, 'Để trống khi chưa thi.')}</div><div class="divider"></div><div class="subheading">Điểm phần thực hành</div><div class="form-grid three">${Array.from({ length: count }, (_, i) => scoreField(`Cột thực hành ${i + 1}`, `practice-${i}`, a.practiceScores?.[i])).join('')}</div>`;
  }
  if (course.type === 'internship') {
    return `<div class="form-grid">${scoreField('Điểm tổng kết học phần', 'singleScore', a.singleScore, 'Theo tài liệu nguồn, ngưỡng đạt từ 5.0.')}</div>`;
  }
  return '';
}

function buildCourseFromForm(form, previous) {
  const data = new FormData(form);
  const course = { ...previous };
  course.code = String(data.get('code') || '').trim();
  course.semester = String(data.get('semester') || state.profile.semester || 'Học kỳ hiện tại').trim();
  course.name = String(data.get('name') || '').trim();
  course.credits = Number(data.get('credits'));
  course.type = String(data.get('type'));
  course.grading = String(data.get('grading'));
  course.assessment = { ...previous.assessment };
  course.theoryCredits = Number(data.get('theoryCredits') || previous.theoryCredits || 0);
  course.practiceCredits = Number(data.get('practiceCredits') || previous.practiceCredits || 0);
  course.practiceColumnCount = Number(data.get('practiceColumnCount') || previous.practiceColumnCount || 3);
  if (course.grading === 'passfail') {
    course.assessment.passFailResult = String(data.get('passFailResult') || 'pending');
  } else if (course.grading === 'graded') {
    for (const field of ['regularity', 'midterm', 'finalExam', 'singleScore']) {
      const raw = data.get(field);
      course.assessment[field] = raw === null || raw === '' ? null : Number(raw);
    }
    const practiceScores = [];
    for (let i = 0; i < 5; i += 1) {
      const raw = data.get(`practice-${i}`);
      if (raw !== null) practiceScores[i] = raw === '' ? null : Number(raw);
    }
    if (practiceScores.length) course.assessment.practiceScores = practiceScores;
  }
  return course;
}

function openCourseModal(courseId = null) {
  modalCourseId = courseId;
  const existing = courseId ? state.courses.find((c) => c.id === courseId) : null;
  const course = existing ? structuredClone(existing) : addCourseDefaults();
  const title = existing ? 'Cập nhật học phần' : 'Thêm học phần mới';
  modalRoot.innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><h2 id="modal-title">${title}</h2><p>Khai báo đúng loại học phần để sử dụng công thức phù hợp.</p></div><button class="modal-close" id="close-modal" aria-label="Đóng">×</button></div><form id="course-form"><div class="modal-body"><div class="form-grid"><div class="field"><label>Mã học phần</label><input name="code" value="${esc(course.code)}" placeholder="Ví dụ: MATH101" maxlength="30" /></div><div class="field"><label>Số tín chỉ</label><input type="number" name="credits" min="1" max="30" step="1" value="${course.credits}" required /></div><div class="field full"><label>Tên học phần</label><input name="name" value="${esc(course.name)}" placeholder="Nhập tên môn học" maxlength="100" required /></div><div class="field full"><label>Học kỳ</label><input name="semester" value="${esc(course.semester || state.profile.semester || '')}" placeholder="Ví dụ: HK1 2026–2027" maxlength="40" required /></div><div class="field"><label>Loại học phần</label><select name="type"><option value="theory" ${course.type === 'theory' ? 'selected' : ''}>Lý thuyết</option><option value="practice" ${course.type === 'practice' ? 'selected' : ''}>Thực hành / thí nghiệm</option><option value="integrated" ${course.type === 'integrated' ? 'selected' : ''}>Tích hợp lý thuyết + thực hành</option><option value="internship" ${course.type === 'internship' ? 'selected' : ''}>Thực tập / khóa luận</option></select></div><div class="field"><label>Cách đánh giá</label><select name="grading"><option value="graded" ${course.grading === 'graded' ? 'selected' : ''}>Có điểm số (hệ 10 / hệ 4)</option><option value="passfail" ${course.grading === 'passfail' ? 'selected' : ''}>Đạt / Không đạt (P/F)</option><option value="exempt" ${course.grading === 'exempt' ? 'selected' : ''}>Miễn học / công nhận tín chỉ (M)</option></select></div></div><div class="divider"></div><div class="subheading">Bảng điểm thành phần</div><div id="assessment-fields">${modalAssessmentFields(course)}</div><div id="modal-result-preview"></div><div class="footnote">Dữ liệu điểm chỉ chấp nhận giá trị từ 0 đến 10. Điểm bỏ trống được hiểu là chưa có kết quả, không tự quy thành 0.</div></div><div class="modal-footer"><button type="button" class="btn danger small" id="delete-from-modal" ${existing ? '' : 'style="visibility:hidden"'}>Xóa học phần</button><div class="footer-actions"><button type="button" class="btn secondary" id="cancel-modal">Hủy</button><button type="submit" class="btn">Lưu học phần</button></div></div></form></div></div>`;
  updateModalPreview();
  $('#course-form').addEventListener('input', updateModalPreview);
  $('#course-form').addEventListener('change', (event) => {
    if (['type', 'grading', 'credits', 'practiceCredits', 'practiceColumnCount'].includes(event.target.name)) {
      const current = buildCourseFromForm($('#course-form'), course);
      const replacement = modalAssessmentFields(current);
      $('#assessment-fields').innerHTML = replacement;
    }
    updateModalPreview();
  });
  $('#course-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (!String(data.get('name') || '').trim()) return toast('Tên học phần không được để trống.', 'error');
    const credits = Number(data.get('credits'));
    if (!Number.isInteger(credits) || credits < 1 || credits > 30) return toast('Số tín chỉ phải là số nguyên từ 1 đến 30.', 'error');
    const next = buildCourseFromForm(form, course);
    if (next.type === 'integrated' && next.grading === 'graded' && next.theoryCredits + next.practiceCredits !== next.credits) {
      return toast('Tổng tín chỉ lý thuyết và thực hành phải bằng tổng tín chỉ môn học.', 'error');
    }
    for (const key of ['regularity', 'midterm', 'finalExam', 'singleScore']) {
      const value = next.assessment[key];
      if (value !== null && (!Number.isFinite(value) || value < 0 || value > 10)) return toast('Điểm phải nằm trong khoảng 0–10.', 'error');
    }
    for (const value of next.assessment.practiceScores || []) {
      if (value !== null && (!Number.isFinite(value) || value < 0 || value > 10)) return toast('Điểm thực hành phải nằm trong khoảng 0–10.', 'error');
    }
    if (existing) state.courses = state.courses.map((item) => item.id === existing.id ? next : item);
    else state.courses.unshift(next);
    persist();
    modalRoot.innerHTML = '';
    render();
    toast(existing ? 'Đã cập nhật học phần.' : 'Đã thêm học phần.');
  });
  $('#close-modal').addEventListener('click', closeModal);
  $('#cancel-modal').addEventListener('click', closeModal);
  $('#delete-from-modal').addEventListener('click', () => deleteCourse(course.id));
  $('#modal-backdrop').addEventListener('click', (event) => { if (event.target.id === 'modal-backdrop') closeModal(); });
}

function updateModalPreview() {
  const form = $('#course-form');
  if (!form) return;
  const fallback = modalCourseId ? state.courses.find((c) => c.id === modalCourseId) : addCourseDefaults();
  const course = buildCourseFromForm(form, fallback || addCourseDefaults());
  const result = calculateCourse(course);
  const targetSelect = `<div class="field" style="min-width:130px"><label>Mục tiêu điểm chữ</label><select id="required-target">${GRADE_SCALE.filter((g) => g.letter !== 'F').map((g) => `<option value="${g.min10}" ${g.letter === 'B' ? 'selected' : ''}>${g.letter} · từ ${g.min10.toFixed(1)}</option>`).join('')}</select></div>`;
  const showRequired = course.grading === 'graded' && ['theory', 'integrated'].includes(course.type);
  const required = showRequired ? `<div style="display:flex;align-items:end;gap:10px;flex-wrap:wrap;margin-top:12px">${targetSelect}<div id="required-score" class="required-box" style="flex:1;margin:0">Nhập điểm thường kỳ, giữa kỳ và phần thực hành (nếu có) để tính điểm cuối kỳ tối thiểu.</div></div>` : '';
  const summary = result.status === 'complete'
    ? `<div class="result-box"><div><small>Điểm tổng kết dự kiến · hệ 10</small><p>${esc(result.message || '')}</p></div><div style="text-align:right"><strong>${number(result.score10)}</strong><small>${result.grade ? `${result.grade.letter} · ${result.grade.point4.toFixed(1)}/4` : esc(result.passFail || '')}</small></div></div>`
    : `<div class="required-box" style="background:${result.status === 'blocked' || result.status === 'ineligible' ? 'var(--amber-soft)' : '#f5f6fa'};color:${result.status === 'blocked' || result.status === 'ineligible' ? '#936317' : '#758197'}">${esc(result.message || 'Chưa đủ dữ liệu để tính điểm.')}</div>`;
  $('#modal-result-preview').innerHTML = summary + required;
  const requiredTarget = $('#required-target');
  if (requiredTarget) requiredTarget.addEventListener('change', updateRequiredScore);
  updateRequiredScore();
  function updateRequiredScore() {
    const target = Number($('#required-target')?.value || 5.0);
    const output = $('#required-score');
    if (!output) return;
    const minScore = findMinimumFinalScore(course, target);
    if (minScore === null) {
      output.classList.add('neutral');
      const midterm = course.assessment?.midterm;
      const regularity = course.assessment?.regularity;
      if (midterm === 0) {
        output.textContent = 'Không đủ điều kiện thi cuối kỳ do điểm giữa kỳ bằng 0.';
      } else if (regularity === null || regularity === undefined || regularity === '' || midterm === null || midterm === undefined || midterm === '') {
        output.textContent = 'Nhập điểm thường kỳ và giữa kỳ để tính ngược điểm cuối kỳ.';
      } else if (course.type === 'integrated' && result.status === 'blocked') {
        output.textContent = 'Điểm thực hành dưới 3.0: đang bị chặn điều kiện thi phần lý thuyết.';
      } else {
        const best = calculateCourse({ ...course, assessment: { ...course.assessment, finalExam: 10 } });
        if (best.status === 'complete' && best.score10 < target) {
          output.innerHTML = `Không thể đạt mức ${target.toFixed(1)} với điểm thành phần hiện tại. Ngay cả khi cuối kỳ đạt 10.00, điểm tổng kết tối đa chỉ là <strong>${best.score10.toFixed(1)}</strong>.`;
        } else {
          output.textContent = 'Chưa thể tính do thiếu dữ liệu hoặc điều kiện đặc biệt của học phần.';
        }
      }
    } else {
      output.classList.remove('neutral');
      output.innerHTML = `Điểm cuối kỳ tối thiểu: <strong>${minScore.toFixed(2)}/10</strong> để đạt từ ${target.toFixed(1)} điểm tổng kết, theo mô hình hiện tại.`;
    }
  }
}

function closeModal() { modalRoot.innerHTML = ''; modalCourseId = null; }

function deleteCourse(courseId) {
  const course = state.courses.find((item) => item.id === courseId);
  if (!course) return;
  if (!window.confirm(`Xóa học phần “${course.name}”? Thao tác này không thể hoàn tác.`)) return;
  state.courses = state.courses.filter((item) => item.id !== courseId);
  delete plannerSelections[courseId];
  persist();
  closeModal();
  render();
  toast('Đã xóa học phần.');
}

function changeView(view) {
  if (!pageInfo[view]) return;
  activeView = view;
  searchTerm = '';
  render();
  $('#sidebar')?.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveProfile() {
  const name = $('#profile-name')?.value.trim();
  const cohort = $('#profile-cohort')?.value.trim();
  const semester = $('#profile-semester')?.value.trim();
  const goal = Number($('#profile-goal')?.value);
  if (!Number.isFinite(goal) || goal < 0 || goal > 4) return toast('GPA mục tiêu phải từ 0 đến 4.', 'error');
  state.profile = { ...state.profile, name: name || 'Sinh viên IUH', cohort: cohort || 'K22', semester: semester || 'Học kỳ hiện tại', goalGpa: goal };
  persist();
  render();
  toast('Đã lưu thiết lập hồ sơ.');
}

// Delegated interactions keep the UI implementation small and predictable.
document.addEventListener('click', (event) => {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) return changeView(viewButton.dataset.view);
  if (event.target.closest('#mobile-menu')) return $('#sidebar')?.classList.toggle('open');
  if (event.target.closest('#add-course')) return openCourseModal();
  const edit = event.target.closest('[data-edit-course]');
  if (edit) return openCourseModal(edit.dataset.editCourse);
  const del = event.target.closest('[data-delete-course]');
  if (del) return deleteCourse(del.dataset.deleteCourse);
  if (event.target.closest('#backup-top') || event.target.closest('#export-data')) {
    exportState(state);
    return toast('Đã tạo tệp sao lưu JSON.');
  }
  if (event.target.closest('#save-profile')) return saveProfile();
  if (event.target.closest('#reset-demo')) {
    if (!window.confirm('Khôi phục dữ liệu minh họa? Dữ liệu hiện tại sẽ bị thay thế.')) return;
    state = createDemoData(); plannerSelections = {}; persist(); render(); return toast('Đã khôi phục dữ liệu minh họa.');
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'course-search') {
    const position = event.target.selectionStart;
    searchTerm = event.target.value;
    const root = $('#view-root');
    const scrollTop = window.scrollY;
    root.innerHTML = renderCourses();
    const input = $('#course-search');
    input?.focus(); input?.setSelectionRange(position, position);
    window.scrollTo(0, scrollTop);
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'semester-select') {
    state.profile.semester = event.target.value;
    persist();
    render();
    return;
  }
  if (event.target.id === 'goal-gpa') {
    const value = Number(event.target.value);
    if (!Number.isFinite(value) || value < 0 || value > 4) return toast('GPA mục tiêu phải từ 0 đến 4.', 'error');
    state.profile.goalGpa = value;
    persist();
    render();
    return;
  }
  if (event.target.matches('.plan-grade')) {
    plannerSelections[event.target.dataset.planCourse] = event.target.value;
    const scrollY = window.scrollY;
    render();
    window.scrollTo(0, scrollY);
  }
  if (event.target.id === 'import-file' && event.target.files?.[0]) {
    importState(event.target.files[0]).then((imported) => {
      state = imported;
      persist(); render(); toast('Đã nhập dữ liệu sao lưu.');
    }).catch((error) => toast(error.message || 'Không thể đọc tệp sao lưu.', 'error'));
    event.target.value = '';
  }
});

render();
