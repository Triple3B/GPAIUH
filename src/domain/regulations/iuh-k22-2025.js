/**
 * Versioned rule profile for IUH GradeTrack.
 * Encodes the user-provided K22 research note, not a legal opinion.
 * Verify the exact effective version and edge cases against IUH's original documents.
 */
export const IUH_K22_2025 = Object.freeze({
  id: 'IUH-K22-2025-research-profile',
  label: 'IUH · K22 · Quy chế đào tạo tín chỉ 2025 (bộ quy tắc nghiên cứu)',
  cohort: 'K22',
  theoryWeights: Object.freeze({ regularity: 0.2, midterm: 0.3, finalExam: 0.5 }),
  finalExamOverrideThreshold: 3.0,
  midtermZeroBlocksFinal: true,
  componentRounding: Object.freeze({ lowerCutoff: 0.25, upperCutoff: 0.75, midpoint: 0.5 }),
  practiceColumns: Object.freeze([{ maxCredits: 2, count: 3 }, { minCredits: 3, count: 5 }]),
  integratedPracticeMinimum: 3.0,
  gradeScale: Object.freeze([
    Object.freeze({ letter: 'A+', min10: 9.0, max10: 10.0, point4: 4.0, label: 'Xuất sắc' }),
    Object.freeze({ letter: 'A', min10: 8.5, max10: 8.9, point4: 3.8, label: 'Giỏi' }),
    Object.freeze({ letter: 'B+', min10: 8.0, max10: 8.4, point4: 3.5, label: 'Khá' }),
    Object.freeze({ letter: 'B', min10: 7.0, max10: 7.9, point4: 3.0, label: 'Khá' }),
    Object.freeze({ letter: 'C+', min10: 6.0, max10: 6.9, point4: 2.5, label: 'Trung bình khá' }),
    Object.freeze({ letter: 'C', min10: 5.5, max10: 5.9, point4: 2.0, label: 'Trung bình' }),
    Object.freeze({ letter: 'D+', min10: 5.0, max10: 5.4, point4: 1.5, label: 'Yếu' }),
    Object.freeze({ letter: 'D', min10: 4.0, max10: 4.9, point4: 1.0, label: 'Yếu' }),
    Object.freeze({ letter: 'F', min10: 0.0, max10: 3.9, point4: 0.0, label: 'Không đạt' }),
  ]),
  academicClassification: Object.freeze([
    Object.freeze({ min4: 3.6, label: 'Xuất sắc' }),
    Object.freeze({ min4: 3.2, label: 'Giỏi' }),
    Object.freeze({ min4: 2.5, label: 'Khá' }),
    Object.freeze({ min4: 2.0, label: 'Trung bình' }),
    Object.freeze({ min4: 0.0, label: 'Kém' }),
  ]),
  sources: Object.freeze([
    'https://pdt.iuh.edu.vn/quy-che-dao-tao',
    'https://tqa.iuh.edu.vn/wp-content/uploads/2025/12/Quyet-dinh-so-610-QD-DHCN-ve-viec-ban-hanh-Quy-che-quan-ly-cong-tac-thi-va-danh-gia-ket-qua-hoc-tap..pdf',
  ]),
});
