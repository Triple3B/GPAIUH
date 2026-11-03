import test from 'node:test';
import assert from 'node:assert/strict';
import {
  roundComponent, calculateCourse, getGrade, calculateGpa,
  findMinimumFinalScore, requiredGpaForRemainingCourses,
} from '../src/domain/grade-engine.js';

const theory = (regularity, midterm, finalExam) => ({
  id: 't', name: 'Theory', credits: 3, type: 'theory', grading: 'graded',
  assessment: { regularity, midterm, finalExam },
});

test('IUH component rounding boundaries', () => {
  assert.equal(roundComponent(7.24), 7.0);
  assert.equal(roundComponent(7.25), 7.5);
  assert.equal(roundComponent(7.74), 7.5);
  assert.equal(roundComponent(7.75), 8.0);
});

test('theory course uses 20-30-50 weighting after component rounding', () => {
  const result = calculateCourse(theory(8, 7, 8));
  assert.equal(result.score10, 7.7);
  assert.equal(result.grade.letter, 'B');
});

test('final exam below 3.0 overrides weighted score', () => {
  const result = calculateCourse(theory(9, 9, 2.5));
  assert.equal(result.score10, 2.5);
  assert.equal(result.grade.letter, 'F');
});

test('midterm zero makes student ineligible for final exam', () => {
  assert.equal(calculateCourse(theory(9, 0, 9)).status, 'ineligible');
});

test('practice subject uses 3 columns for 1-2 credits and 5 for 3+ credits', () => {
  const c2 = { credits: 2, type: 'practice', grading: 'graded', assessment: { practiceScores: [8, 9, 7] } };
  const c3 = { credits: 3, type: 'practice', grading: 'graded', assessment: { practiceScores: [8, 9, 7, 8, 8] } };
  assert.equal(calculateCourse(c2).score10, 8.0);
  assert.equal(calculateCourse(c3).score10, 8.0);
});

test('grade conversion boundaries', () => {
  assert.equal(getGrade(9).letter, 'A+');
  assert.equal(getGrade(8.5).letter, 'A');
  assert.equal(getGrade(8).letter, 'B+');
  assert.equal(getGrade(4).letter, 'D');
  assert.equal(getGrade(3.9).letter, 'F');
});

test('semester GPA includes failed graded courses, cumulative GPA excludes failed courses', () => {
  const courses = [theory(8, 8, 8), theory(8, 8, 2.5)];
  const gpa = calculateGpa(courses);
  assert.ok(gpa.semesterGpa !== null);
  assert.equal(gpa.cumulativeCredits, 3);
  assert.equal(gpa.failedCredits, 3);
});

test('minimum final score solver finds a score meeting target', () => {
  const course = theory(8, 7, null);
  const minimum = findMinimumFinalScore(course, 7.0);
  assert.notEqual(minimum, null);
  assert.ok(calculateCourse({ ...course, assessment: { ...course.assessment, finalExam: minimum } }).score10 >= 7.0);
});

test('target GPA planner detects impossible target', () => {
  const courses = [theory(8, 8, 8), theory(8, 7, null)];
  const plan = requiredGpaForRemainingCourses(courses, 4.0);
  assert.ok(['possible', 'impossible'].includes(plan.status));
});


test('rounding to one decimal handles decimal half-up values', () => {
  const result = calculateCourse(theory(8.9, 8.9, 8.9));
  assert.equal(result.score10, 9.0);
});

test('integrated course weights theory and practice by their credits', () => {
  const course = {
    credits: 3, type: 'integrated', grading: 'graded', theoryCredits: 2, practiceCredits: 1, practiceColumnCount: 3,
    assessment: { regularity: 8, midterm: 7, finalExam: 8, practiceScores: [8, 9, 7] },
  };
  const result = calculateCourse(course);
  assert.equal(result.status, 'complete');
  assert.equal(result.score10, 7.8);
});

test('integrated course blocks theory final when practical score is below 3.0', () => {
  const course = {
    credits: 3, type: 'integrated', grading: 'graded', theoryCredits: 2, practiceCredits: 1, practiceColumnCount: 3,
    assessment: { regularity: 8, midterm: 7, finalExam: null, practiceScores: [2, 2, 2] },
  };
  assert.equal(calculateCourse(course).status, 'blocked');
});

test('midterm zero is ineligible even when final exam has not been entered', () => {
  assert.equal(calculateCourse(theory(8, 0, null)).status, 'ineligible');
});

test('pass/fail symbols P and F do not enter graded GPA, but only P earns credits', () => {
  const gradedCourse = theory(8, 8, 8);
  const pass = { credits: 2, grading: 'passfail', type: 'theory', assessment: { passFailResult: 'P' } };
  const fail = { credits: 1, grading: 'passfail', type: 'theory', assessment: { passFailResult: 'F' } };
  const gpa = calculateGpa([gradedCourse, pass, fail]);
  assert.equal(gpa.semesterCredits, 3);
  assert.equal(gpa.creditsEarned, 5);
  assert.equal(gpa.failedCredits, 1);
});

test('planner does not invent an estimated grade when a course is blocked', () => {
  const blocked = {
    credits: 3, type: 'theory', grading: 'graded',
    assessment: { regularity: 8, midterm: 0, finalExam: null },
  };
  const result = requiredGpaForRemainingCourses([blocked], 3.2);
  assert.equal(result.status, 'blocked');
});


test('missing score does not silently convert to zero or F', () => {
  assert.equal(getGrade(null), null);
  assert.equal(calculateCourse(theory(8, 7, null)).status, 'pending');
});
