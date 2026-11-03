import { IUH_K22_2025 } from './regulations/iuh-k22-2025.js';

/**
 * IUH GradeTrack — deterministic grading engine.
 * Rules are encoded from the user-provided IUH K22 research note.
 * Unverified interpretations are called out in README.md and in the UI.
 */

export const GRADE_SCALE = IUH_K22_2025.gradeScale;

export const PASS_FAIL_POINTS = Object.freeze({ P: null, F: null, I: null, X: null, M: null });

export function getPracticeColumnCount(credits) {
  const value = Number(credits);
  const rule = IUH_K22_2025.practiceColumns.find((item) => item.maxCredits ? value <= item.maxCredits : value >= item.minCredits);
  return rule?.count ?? 5;
}

export function clampScore(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 10) return null;
  return n;
}

/** IUH component rounding from the supplied note: .00-.24 -> .0; .25-.74 -> .5; .75-.99 -> next .0. */
export function roundComponent(value) {
  const n = clampScore(value);
  if (n === null) return null;
  const whole = Math.floor(n + 1e-9);
  const fraction = n - whole;
  if (fraction < IUH_K22_2025.componentRounding.lowerCutoff - 1e-9) return Number(whole.toFixed(1));
  if (fraction < IUH_K22_2025.componentRounding.upperCutoff - 1e-9) return Number((whole + IUH_K22_2025.componentRounding.midpoint).toFixed(1));
  return Number(Math.min(10, whole + 1).toFixed(1));
}

export function roundCourseScore(value) {
  const n = clampScore(value);
  if (n === null) return null;
  return Math.min(10, Math.max(0, Math.round((n + Number.EPSILON) * 10) / 10));
}

export function getGrade(score) {
  if (score === null || score === undefined || score === '') return null;
  const n = Number(score);
  if (!Number.isFinite(n) || n < 0 || n > 10) return null;
  // The final course score is rounded to one decimal before conversion.
  const rounded = roundCourseScore(n);
  return GRADE_SCALE.find((grade) => rounded >= grade.min10 && rounded <= grade.max10) ?? null;
}

export function getAcademicClassification(gpa4) {
  if (!Number.isFinite(gpa4)) return 'Chưa có dữ liệu';
  return IUH_K22_2025.academicClassification.find((item) => gpa4 >= item.min4)?.label ?? 'Kém';
}

function normalizeScores(scores = []) {
  if (!Array.isArray(scores)) return [];
  return Array.from(scores, (value) => clampScore(value));
}

function result(status, extra = {}) {
  return { status, score10: null, grade: null, ...extra };
}

function calculateTheory(assessment) {
  const regularity = clampScore(assessment.regularity);
  const midterm = clampScore(assessment.midterm);
  const finalExam = clampScore(assessment.finalExam);

  if (midterm === 0) {
    return result('ineligible', {
      message: 'Điểm giữa kỳ bằng 0: không đủ điều kiện dự thi kết thúc học phần theo tài liệu nguồn.',
      roundedComponents: { regularity: regularity === null ? null : roundComponent(regularity), midterm: 0, finalExam: finalExam === null ? null : roundComponent(finalExam) },
    });
  }
  if (regularity === null || midterm === null || finalExam === null) {
    return result('pending', { message: 'Nhập đủ điểm thường kỳ, giữa kỳ và cuối kỳ.' });
  }

  const rounded = {
    regularity: roundComponent(regularity),
    midterm: roundComponent(midterm),
    finalExam: roundComponent(finalExam),
  };

  // Source rule: when the end-of-course exam score is below 3.0, the course result equals that exam score.
  // The threshold is tested against the entered exam score; the displayed result uses component rounding.
  const rawExamBelowThree = finalExam < IUH_K22_2025.finalExamOverrideThreshold;
  const weights = IUH_K22_2025.theoryWeights;
  const weighted = rounded.regularity * weights.regularity + rounded.midterm * weights.midterm + rounded.finalExam * weights.finalExam;
  const score10 = roundCourseScore(rawExamBelowThree ? rounded.finalExam : weighted);

  return result('complete', {
    score10,
    grade: getGrade(score10),
    message: rawExamBelowThree
      ? 'Điểm thi kết thúc học phần dưới 3.0: áp dụng điểm thi cuối kỳ làm điểm tổng kết.'
      : 'Tính theo trọng số 20% – 30% – 50%.',
    roundedComponents: rounded,
    calculation: rawExamBelowThree
      ? `${rounded.finalExam.toFixed(1)} (điểm cuối kỳ dưới 3.0)`
      : `${rounded.regularity.toFixed(1)} × 20% + ${rounded.midterm.toFixed(1)} × 30% + ${rounded.finalExam.toFixed(1)} × 50%`,
  });
}

function calculatePractice(assessment, credits) {
  const expectedCount = getPracticeColumnCount(credits);
  const values = normalizeScores(assessment.practiceScores ?? []);
  if (values.length !== expectedCount || values.some((value) => value === null)) {
    return result('pending', {
      message: `Nhập đủ ${expectedCount} cột điểm thực hành theo số tín chỉ của học phần.`,
      expectedCount,
    });
  }
  const roundedScores = values.map(roundComponent);
  const average = roundedScores.reduce((sum, value) => sum + value, 0) / expectedCount;
  const score10 = roundCourseScore(average);
  return result('complete', {
    score10,
    grade: getGrade(score10),
    roundedComponents: roundedScores,
    expectedCount,
    calculation: `(${roundedScores.map((value) => value.toFixed(1)).join(' + ')}) / ${expectedCount}`,
    message: `Điểm tổng kết là trung bình cộng ${expectedCount} cột thực hành.`,
  });
}

export function calculateCourse(course) {
  const type = course.type ?? 'theory';
  const credits = Number(course.credits) || 0;
  const assessment = course.assessment ?? {};

  if (course.grading === 'passfail') {
    const passFail = assessment.passFailResult;
    if (!passFail || passFail === 'pending' || passFail === 'X') return result('pending', { passFail: passFail || 'X', message: 'Chưa đủ dữ liệu hoặc chưa có kết quả chính thức.' });
    if (passFail === 'I' || passFail === 'M') return result('excluded', { passFail, message: 'Trạng thái hành chính chưa/không đưa vào GPA theo tài liệu nguồn.' });
    return result('complete', {
      passFail,
      grade: null,
      score10: null,
      passed: passFail === 'P',
      message: 'Học phần không phân mức: không đưa vào GPA theo tài liệu nguồn.',
    });
  }
  if (course.grading === 'exempt') {
    return result('excluded', { message: 'Học phần miễn học/công nhận tín chỉ: không đưa vào GPA theo tài liệu nguồn.' });
  }

  if (type === 'theory') return calculateTheory(assessment);
  if (type === 'practice') return calculatePractice(assessment, credits);

  if (type === 'integrated') {
    const theory = calculateTheory(assessment);
    const practiceCredits = Number(course.practiceCredits ?? 0);
    const theoryCredits = Number(course.theoryCredits ?? (credits - practiceCredits));
    const practiceCount = Number(course.practiceColumnCount ?? getPracticeColumnCount(practiceCredits));
    const practicalValues = normalizeScores(assessment.practiceScores ?? []);
    const practiceComplete = practicalValues.length === practiceCount && practicalValues.every((v) => v !== null);
    let roundedPractice = null;
    let practiceScore = null;
    if (practiceComplete) {
      roundedPractice = practicalValues.map(roundComponent);
      practiceScore = roundCourseScore(roundedPractice.reduce((a, b) => a + b, 0) / practiceCount);
      if (practiceScore === 0) {
        return result('complete', {
          score10: 0,
          grade: getGrade(0),
          theory,
          practiceScore,
          roundedPractice,
          message: 'Điểm thực hành bằng 0: điểm tổng kết học phần tích hợp bằng 0.',
        });
      }
      if (practiceScore < IUH_K22_2025.integratedPracticeMinimum) {
        return result('blocked', {
          theory,
          practiceScore,
          roundedPractice,
          message: 'Điểm thực hành dưới 3.0: chưa đủ điều kiện thi cuối kỳ phần lý thuyết. Không tự suy đoán điểm tổng kết.',
        });
      }
    }
    if (theory.status === 'ineligible') {
      return result('ineligible', { message: theory.message, theory, practiceScore, roundedPractice });
    }
    if (!practiceComplete || theory.status !== 'complete') {
      return result('pending', {
        message: `Cần đủ điểm lý thuyết và ${practiceCount} cột điểm thực hành để tính học phần tích hợp.`,
        theory,
        practiceScore,
        expectedCount: practiceCount,
      });
    }
    if (theory.score10 === 0) {
      return result('complete', {
        score10: 0,
        grade: getGrade(0),
        theory,
        practiceScore,
        roundedPractice,
        message: 'Điểm lý thuyết bằng 0: điểm tổng kết học phần tích hợp bằng 0.',
      });
    }
    if (theoryCredits <= 0 || practiceCredits <= 0 || theoryCredits + practiceCredits !== credits || !Number.isInteger(practiceCount) || ![3, 5].includes(practiceCount)) {
      return result('configuration', {
        theory,
        practiceScore,
        roundedPractice,
        message: 'Cần khai báo số tín chỉ lý thuyết và thực hành hợp lệ; tổng hai phần phải bằng tổng tín chỉ học phần và số cột thực hành phải là 3 hoặc 5.',
      });
    }
    const score10 = roundCourseScore((theory.score10 * theoryCredits + practiceScore * practiceCredits) / credits);
    return result('complete', {
      score10,
      grade: getGrade(score10),
      theory,
      practiceScore,
      roundedPractice,
      message: `Tổng hợp theo tín chỉ: LT ${theoryCredits} TC, TH ${practiceCredits} TC.`,
      calculation: `(${theory.score10.toFixed(1)} × ${theoryCredits} + ${practiceScore.toFixed(1)} × ${practiceCredits}) / ${credits}`,
    });
  }

  if (type === 'internship') {
    const score = clampScore(assessment.singleScore);
    if (score === null) return result('pending', { message: 'Nhập điểm tổng kết học phần.' });
    const score10 = roundCourseScore(roundComponent(score));
    return result('complete', {
      score10,
      grade: getGrade(score10),
      message: 'Học phần có một cột điểm tổng kết; ngưỡng đạt từ 5.0 theo tài liệu nguồn.',
    });
  }

  return result('configuration', { message: 'Loại học phần chưa được hỗ trợ.' });
}

export function findMinimumFinalScore(course, targetScore10) {
  const target = Number(targetScore10);
  if (!Number.isFinite(target) || target < 0 || target > 10) return null;
  const base = course.assessment ?? {};
  if (clampScore(base.regularity) === null || clampScore(base.midterm) === null || Number(base.midterm) === 0) return null;
  if (course.type === 'integrated') {
    const practiceCredits = Number(course.practiceCredits ?? 0);
    const count = Number(course.practiceColumnCount ?? getPracticeColumnCount(practiceCredits));
    const practiceScores = normalizeScores(base.practiceScores ?? []);
    if (practiceScores.length !== count || practiceScores.some((v) => v === null)) return null;
    const practiceAverage = practiceScores.map(roundComponent).reduce((a, b) => a + b, 0) / count;
    if (practiceAverage < 3) return null;
  }
  for (let i = 0; i <= 1000; i += 1) {
    const finalExam = i / 100;
    const trial = calculateCourse({ ...course, assessment: { ...base, finalExam } });
    if (trial.status === 'complete' && trial.score10 !== null && trial.score10 >= target) return finalExam;
  }
  return null;
}

export function calculateGpa(courses) {
  const graded = courses
    .filter((course) => course.grading !== 'passfail' && course.grading !== 'exempt')
    .map((course) => ({ course, result: calculateCourse(course) }))
    .filter(({ result }) => result.status === 'complete' && result.grade);

  const semesterCredits = graded.reduce((sum, item) => sum + Number(item.course.credits || 0), 0);
  const semesterWeighted = graded.reduce((sum, item) => sum + item.result.grade.point4 * Number(item.course.credits || 0), 0);
  const semesterGpa = semesterCredits > 0 ? semesterWeighted / semesterCredits : null;

  const passed = graded.filter(({ result }) => result.score10 >= 4.0);
  const cumulativeCredits = passed.reduce((sum, item) => sum + Number(item.course.credits || 0), 0);
  const cumulativeWeighted = passed.reduce((sum, item) => sum + item.result.grade.point4 * Number(item.course.credits || 0), 0);
  const cumulativeGpa = cumulativeCredits > 0 ? cumulativeWeighted / cumulativeCredits : null;

  const creditsRegistered = courses.reduce((sum, course) => sum + Number(course.credits || 0), 0);
  const creditsEarned = courses.reduce((sum, course) => {
    if (course.grading === 'exempt') return sum + Number(course.credits || 0);
    const res = calculateCourse(course);
    if (course.grading === 'passfail') return sum + (res.status === 'complete' && res.passed ? Number(course.credits || 0) : 0);
    return sum + (res.status === 'complete' && res.score10 >= 4 ? Number(course.credits || 0) : 0);
  }, 0);
  const failedCredits = courses.reduce((sum, course) => {
    const res = calculateCourse(course);
    const isNumericFail = course.grading === 'graded' && res.status === 'complete' && res.score10 < 4;
    const isPassFailFail = course.grading === 'passfail' && res.status === 'complete' && res.passFail === 'F';
    return sum + ((isNumericFail || isPassFailFail) ? Number(course.credits || 0) : 0);
  }, 0);

  return {
    semesterGpa,
    cumulativeGpa,
    semesterCredits,
    cumulativeCredits,
    creditsRegistered,
    creditsEarned,
    failedCredits,
    gradedCoursesCount: graded.length,
    pendingCoursesCount: courses.filter((course) => ['pending', 'blocked', 'ineligible', 'configuration'].includes(calculateCourse(course).status)).length,
  };
}

export function requiredGpaForRemainingCourses(courses, targetGpa) {
  const target = Number(targetGpa);
  if (!Number.isFinite(target) || target < 0 || target > 4) return { status: 'invalid' };
  const gradedCourses = courses.filter((course) => course.grading === 'graded');
  const results = gradedCourses.map((course) => ({ course, result: calculateCourse(course) }));
  const fixed = results.filter(({ result }) => result.status === 'complete' && result.grade);
  const pending = results.filter(({ result }) => result.status === 'pending');
  const blocked = results.filter(({ result }) => ['blocked', 'ineligible', 'configuration'].includes(result.status));
  const fixedCredits = fixed.reduce((sum, item) => sum + Number(item.course.credits || 0), 0);
  const fixedPoints = fixed.reduce((sum, item) => sum + item.result.grade.point4 * Number(item.course.credits || 0), 0);
  const pendingCredits = pending.reduce((sum, item) => sum + Number(item.course.credits || 0), 0);
  const blockedCredits = blocked.reduce((sum, item) => sum + Number(item.course.credits || 0), 0);
  const remainingCredits = pendingCredits + blockedCredits;
  const totalCredits = fixedCredits + remainingCredits;
  if (!totalCredits) return { status: 'empty' };
  if (blocked.length) {
    return { status: 'blocked', fixedCredits, pendingCredits, blockedCredits, remainingCredits, totalCredits, fixedPoints, pending, blocked };
  }
  if (!pendingCredits) {
    return { status: 'complete', fixedGpa: fixedCredits > 0 ? fixedPoints / fixedCredits : null, requiredAverage: null, fixedCredits, remainingCredits: 0, totalCredits, pending: [] };
  }
  const requiredAverage = (target * totalCredits - fixedPoints) / pendingCredits;
  if (requiredAverage > 4.0 + 1e-9) return { status: 'impossible', requiredAverage, fixedCredits, remainingCredits: pendingCredits, totalCredits, pending };
  if (requiredAverage <= 0) return { status: 'safe', requiredAverage: Math.max(0, requiredAverage), fixedCredits, remainingCredits: pendingCredits, totalCredits, pending };
  const recommended = [...GRADE_SCALE].reverse().find((grade) => grade.point4 >= requiredAverage - 1e-9);
  return { status: 'possible', requiredAverage, recommended, fixedCredits, remainingCredits: pendingCredits, totalCredits, pending };
}

export function getCourseStatusLabel(course) {
  const res = calculateCourse(course);
  if (res.status === 'complete') {
    if (course.grading === 'passfail') return res.passed ? 'Đạt' : 'Không đạt';
    return res.score10 >= 4 ? 'Đã đạt' : 'Không đạt';
  }
  if (res.status === 'ineligible') return 'Không đủ điều kiện thi';
  if (res.status === 'blocked') return 'Bị chặn điều kiện';
  if (res.status === 'configuration') return 'Thiếu cấu hình';
  if (res.status === 'excluded') return res.passFail === 'I' ? 'Hoãn thi có phép (I)' : res.passFail === 'M' || course.grading === 'exempt' ? 'Miễn / công nhận tín chỉ' : 'Không tính GPA';
  return 'Đang cập nhật';
}
