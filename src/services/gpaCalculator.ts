// File: src/services/gpaCalculator.ts
// GPA Calculation Engine — Quy chế ĐHQGHN 2022
// Toàn bộ logic tính toán chạy client-side, không cần API

import {
  GPATemplateType,
  GPACourse,
  GPASemester,
  GPAComputed,
  GPASemesterSummary,
  GPACumulativeData,
  GPAProjection,
} from '../types';
import {
  GRADE_SCALE,
  TEMPLATE_WEIGHTS,
  WARNING_THRESHOLDS,
  GRADUATION_HONORS,
} from '../constants';

// ────────────────────────────────────────
// 1. TÍNH ĐIỂM HỌC PHẦN (Course Score)
// ────────────────────────────────────────

/**
 * Tính điểm học phần /10 theo template và điểm thành phần
 * Làm tròn 1 chữ số thập phân theo quy chế
 */
export function calculateCourseScore(
  scores: { cc1?: number | null; cc2?: number | null; cc3?: number | null; final?: number | null },
  template: GPATemplateType
): number | null {
  const weights = TEMPLATE_WEIGHTS[template];
  if (!weights) return null;

  const { cc1, cc2, cc3, final: finalScore } = scores;

  // Kiểm tra các điểm bắt buộc đã nhập đầy đủ chưa
  if (finalScore == null || finalScore === undefined) return null;

  switch (template) {
    case GPATemplateType.A: {
      // CC1 (10%) + CC2 (30%) + Cuối kỳ (60%)
      if (cc1 == null || cc2 == null) return null;
      const raw = cc1 * weights.cc1 + cc2 * weights.cc2 + finalScore * weights.final;
      return roundTo1Decimal(raw);
    }
    case GPATemplateType.B: {
      // CC1 (10%) + CC2 (10%) + CC3 (20%) + Cuối kỳ (60%)
      if (cc1 == null || cc2 == null || cc3 == null) return null;
      const raw = cc1 * weights.cc1 + cc2 * weights.cc2 + (cc3 * (weights.cc3 || 0)) + finalScore * weights.final;
      return roundTo1Decimal(raw);
    }
    case GPATemplateType.C: {
      // CC1 (20%) + CC2 (20%) + Cuối kỳ (60%)
      if (cc1 == null || cc2 == null) return null;
      const raw = cc1 * weights.cc1 + cc2 * weights.cc2 + finalScore * weights.final;
      return roundTo1Decimal(raw);
    }
    default:
      return null;
  }
}

/**
 * Tra bảng quy đổi: Điểm /10 → Điểm chữ (A+, A, B+, B, C+, C, D+, D, F)
 */
export function getLetterGrade(score10: number | null): string | null {
  if (score10 == null) return null;
  for (const entry of GRADE_SCALE) {
    if (score10 >= entry.min && score10 <= entry.max) {
      return entry.letter;
    }
  }
  return 'F'; // Fallback
}

/**
 * Tra bảng quy đổi: Điểm chữ → Thang 4
 */
export function getGrade4(letterGrade: string | null): number | null {
  if (!letterGrade) return null;
  const entry = GRADE_SCALE.find(g => g.letter === letterGrade);
  return entry ? entry.grade4 : null;
}

/**
 * Kiểm tra môn học đã đạt hay chưa (D trở lên = đạt)
 */
export function isPassed(score10: number | null): boolean {
  if (score10 == null) return false;
  return score10 >= 4.0; // D trở lên là đạt
}

/**
 * Tính toàn bộ computed fields cho một môn học
 */
export function computeCourse(course: GPACourse): GPAComputed {
  const scores = {
    cc1: course.score_cc1,
    cc2: course.score_cc2,
    cc3: course.score_cc3,
    final: course.score_final,
  };

  const score10 = calculateCourseScore(scores, course.template);
  const letterGrade = getLetterGrade(score10);
  const grade4 = getGrade4(letterGrade);
  const passed = isPassed(score10);

  return { score10, letterGrade, grade4, passed };
}

/**
 * Tính computed cho tất cả courses trong semester và trả về courses mới
 */
export function computeAllCourses(courses: GPACourse[]): GPACourse[] {
  return courses.map(course => ({
    ...course,
    computed: computeCourse(course),
  }));
}

// ────────────────────────────────────────
// 2. TÍNH GPA HỌC KỲ & TÍCH LŨY
// ────────────────────────────────────────

/**
 * GPA Học kỳ = Σ(điểm_thang4 × tín_chỉ) ÷ Σ(tín_chỉ)
 * Tính KỂ CẢ môn F, KHÔNG tính môn exclude_from_gpa
 * Làm tròn 2 chữ số thập phân
 */
export function calculateSemesterGPA(courses: GPACourse[]): number | null {
  const gradedCourses = courses.filter(c => {
    if (c.exclude_from_gpa || c.is_conditional) return false;
    const computed = c.computed || computeCourse(c);
    return computed.score10 != null && computed.grade4 != null;
  });

  if (gradedCourses.length === 0) return null;

  let totalWeightedPoints = 0;
  let totalCredits = 0;

  for (const course of gradedCourses) {
    const computed = course.computed || computeCourse(course);
    if (computed.grade4 != null) {
      totalWeightedPoints += computed.grade4 * course.credits;
      totalCredits += course.credits;
    }
  }

  if (totalCredits === 0) return null;
  return roundTo2Decimal(totalWeightedPoints / totalCredits);
}

/**
 * GPA Tích lũy = Σ(điểm_thang4 × tín_chỉ) ÷ Σ(tín_chỉ)
 * CHỈ TÍNH môn ĐÃ ĐẠT (D trở lên), loại F
 * Xử lý học lại: Nếu môn có retake_of, thay thế điểm cũ
 */
export function calculateCumulativeGPA(semesters: GPASemester[]): number | null {
  // Collect all courses from all semesters, handle retakes
  const allCourses = collectAllCoursesWithRetakes(semesters);

  const passedCourses = allCourses.filter(c => {
    if (c.exclude_from_gpa || c.is_conditional) return false;
    const computed = c.computed || computeCourse(c);
    return computed.passed && computed.grade4 != null;
  });

  if (passedCourses.length === 0) return null;

  let totalWeightedPoints = 0;
  let totalCredits = 0;

  for (const course of passedCourses) {
    const computed = course.computed || computeCourse(course);
    if (computed.grade4 != null) {
      totalWeightedPoints += computed.grade4 * course.credits;
      totalCredits += course.credits;
    }
  }

  if (totalCredits === 0) return null;
  return roundTo2Decimal(totalWeightedPoints / totalCredits);
}

/**
 * Thu thập tất cả courses, xử lý học lại (course mới thay thế course cũ)
 */
function collectAllCoursesWithRetakes(semesters: GPASemester[]): GPACourse[] {
  const allCourses: GPACourse[] = [];
  const retakenIds = new Set<string>();

  // Thu thập IDs các môn đã bị học lại
  for (const sem of semesters) {
    for (const course of sem.courses) {
      if (course.retake_of) {
        retakenIds.add(course.retake_of);
      }
    }
  }

  // Lấy tất cả courses, bỏ qua các môn đã bị thay thế
  for (const sem of semesters) {
    for (const course of sem.courses) {
      if (!retakenIds.has(course.id)) {
        allCourses.push(course);
      }
    }
  }

  return allCourses;
}

// ────────────────────────────────────────
// 3. TỔNG KẾT HỌC KỲ (Semester Summary)
// ────────────────────────────────────────

/**
 * Tính toàn bộ summary cho một học kỳ
 */
export function calculateSemesterSummary(
  semester: GPASemester,
  allSemesters: GPASemester[]
): GPASemesterSummary {
  const coursesComputed = computeAllCourses(semester.courses);

  const creditsRegistered = coursesComputed.reduce((sum, c) => sum + c.credits, 0);

  const creditsPassed = coursesComputed
    .filter(c => {
      const computed = c.computed || computeCourse(c);
      return computed.passed;
    })
    .reduce((sum, c) => sum + c.credits, 0);

  const creditsGPA = coursesComputed
    .filter(c => !c.exclude_from_gpa && !c.is_conditional)
    .reduce((sum, c) => sum + c.credits, 0);

  const semesterGPA = calculateSemesterGPA(coursesComputed);

  // Tính GPA tích lũy tính đến kỳ này
  const semesterIndex = allSemesters.findIndex(s => s.id === semester.id);
  const semestersUpToCurrent = allSemesters.slice(0, semesterIndex + 1);
  const cumulativeGPA = calculateCumulativeGPA(semestersUpToCurrent);

  const academicStanding = getAcademicStanding(semesterGPA);

  return {
    semester_gpa: semesterGPA,
    cumulative_gpa: cumulativeGPA,
    credits_registered: creditsRegistered,
    credits_passed: creditsPassed,
    credits_gpa: creditsGPA,
    academic_standing: academicStanding,
  };
}

// ────────────────────────────────────────
// 4. XẾP LOẠI HỌC LỰC & CẢNH BÁO
// ────────────────────────────────────────

/**
 * Xếp loại học lực theo GPA (thang 4)
 */
export function getAcademicStanding(gpa: number | null): string | null {
  if (gpa == null) return null;
  if (gpa >= 3.6) return 'Xuất sắc';
  if (gpa >= 3.2) return 'Giỏi';
  if (gpa >= 2.5) return 'Khá';
  if (gpa >= 2.0) return 'Trung bình';
  return 'Yếu';
}

/**
 * Kiểm tra cảnh báo học vụ dựa trên GPA tích lũy và năm học
 */
export function checkAcademicWarning(
  cumulativeGPA: number | null,
  semesterGPA: number | null,
  yearOfStudy: number,
  totalFailedCredits: number = 0,
  semesterFailedRatio: number = 0
): { level: 'safe' | 'early_warning' | 'warning' | 'danger'; message: string } {
  // Default safe
  if (cumulativeGPA == null) {
    return { level: 'safe', message: '' };
  }

  // Kiểm tra nợ quá 24TC F hoặc >50% TC kỳ trượt
  if (totalFailedCredits >= 24 || semesterFailedRatio >= 0.5) {
    return {
      level: 'danger',
      message: totalFailedCredits >= 24
        ? `Bạn đang nợ ${totalFailedCredits} tín chỉ F (ngưỡng nguy hiểm: 24 TC). Cần gặp cố vấn học tập ngay!`
        : `Số tín chỉ không đạt trong kỳ vượt 50% khối lượng đăng ký. Cần gặp cố vấn học tập ngay!`,
    };
  }

  // Tìm ngưỡng cảnh báo theo năm
  const threshold = WARNING_THRESHOLDS.find(t => t.year === Math.min(yearOfStudy, 4));
  if (!threshold) {
    return { level: 'safe', message: '' };
  }

  // Cảnh báo GPA tích lũy
  if (cumulativeGPA < threshold.cumulative) {
    return {
      level: 'warning',
      message: `GPA tích lũy (${cumulativeGPA.toFixed(2)}) đang dưới ngưỡng an toàn năm ${yearOfStudy} (${threshold.cumulative}). Bạn có nguy cơ bị cảnh báo học vụ!`,
    };
  }

  // Cảnh báo sớm (trong 0.2 điểm so với ngưỡng)
  if (cumulativeGPA < threshold.cumulative + 0.2) {
    return {
      level: 'early_warning',
      message: `GPA tích lũy (${cumulativeGPA.toFixed(2)}) đang gần ngưỡng cảnh báo năm ${yearOfStudy} (${threshold.cumulative}). Cách ngưỡng ${(cumulativeGPA - threshold.cumulative).toFixed(2)} điểm.`,
    };
  }

  // Cảnh báo GPA học kỳ (nếu có)
  if (semesterGPA != null && semesterGPA < threshold.semester) {
    return {
      level: 'early_warning',
      message: `GPA học kỳ (${semesterGPA.toFixed(2)}) dưới ngưỡng khuyến nghị (${threshold.semester}). Cần cải thiện kỳ sau.`,
    };
  }

  return { level: 'safe', message: '' };
}

// ────────────────────────────────────────
// 5. DỰ BÁO TỐT NGHIỆP
// ────────────────────────────────────────

/**
 * Dự báo hạng tốt nghiệp dựa trên GPA tích lũy hiện tại
 */
export function predictGraduationHonor(cumulativeGPA: number | null): string | null {
  if (cumulativeGPA == null) return null;
  for (const honor of GRADUATION_HONORS) {
    if (cumulativeGPA >= honor.min && cumulativeGPA <= honor.max) {
      return honor.label;
    }
  }
  return 'Chưa đủ điều kiện (GPA < 2.00)';
}

/**
 * Tính GPA cần thiết cho N kỳ còn lại để đạt mục tiêu hạng tốt nghiệp
 */
export function calculateRequiredGPA(
  currentCumulativeGPA: number,
  currentCredits: number,
  targetGPA: number,
  remainingCredits: number
): number | null {
  if (remainingCredits <= 0) return null;

  // targetGPA = (currentGPA * currentCredits + requiredGPA * remainingCredits) / totalCredits
  // requiredGPA = (targetGPA * totalCredits - currentGPA * currentCredits) / remainingCredits
  const totalCredits = currentCredits + remainingCredits;
  const required = (targetGPA * totalCredits - currentCumulativeGPA * currentCredits) / remainingCredits;

  if (required > 4.0) return null; // Không thể đạt được
  if (required < 0) return 0; // Đã đạt rồi

  return roundTo2Decimal(required);
}

/**
 * Tính tổng hợp dữ liệu tích lũy toàn khóa
 */
export function calculateCumulativeData(
  semesters: GPASemester[],
  totalCreditsRequired: number = 120,
  yearOfStudy: number = 1
): GPACumulativeData {
  const cumulativeGPA = calculateCumulativeGPA(semesters);

  // Tổng TC tích lũy (chỉ môn đạt, loại exclude_from_gpa)
  const allCourses = collectAllCoursesWithRetakes(semesters);
  const creditsAccumulated = allCourses
    .filter(c => {
      const computed = c.computed || computeCourse(c);
      return computed.passed;
    })
    .reduce((sum, c) => sum + c.credits, 0);

  const academicStanding = getAcademicStanding(cumulativeGPA);
  const graduationProjection = predictGraduationHonor(cumulativeGPA);

  // Tính cảnh báo
  const semesterGPA = semesters.length > 0
    ? calculateSemesterGPA(computeAllCourses(semesters[semesters.length - 1].courses))
    : null;
  const totalFailedCredits = allCourses
    .filter(c => {
      const computed = c.computed || computeCourse(c);
      return !computed.passed && !c.exclude_from_gpa && computed.score10 != null;
    })
    .reduce((sum, c) => sum + c.credits, 0);

  const warning = checkAcademicWarning(cumulativeGPA, semesterGPA, yearOfStudy, totalFailedCredits);

  return {
    gpa: cumulativeGPA,
    credits_accumulated: creditsAccumulated,
    total_credits_required: totalCreditsRequired,
    academic_standing: academicStanding,
    graduation_projection: graduationProjection,
    warning_level: warning.level,
  };
}

// ────────────────────────────────────────
// 6. TÍNH NGƯỢC (Reverse Calculation)
// ────────────────────────────────────────

/**
 * Tính điểm cuối kỳ cần thiết để đạt mục tiêu điểm chữ
 * Ví dụ: "Cần bao nhiêu điểm cuối kỳ môn Giải tích để được B+?"
 */
export function calculateRequiredFinalScore(
  currentScores: { cc1?: number | null; cc2?: number | null; cc3?: number | null },
  template: GPATemplateType,
  targetLetterGrade: string
): number | null {
  const weights = TEMPLATE_WEIGHTS[template];
  if (!weights) return null;

  // Tìm điểm /10 tối thiểu cho target letter grade
  const targetEntry = GRADE_SCALE.find(g => g.letter === targetLetterGrade);
  if (!targetEntry) return null;
  const targetMin = targetEntry.min;

  const { cc1, cc2, cc3 } = currentScores;

  let componentSum = 0;
  switch (template) {
    case GPATemplateType.A:
      if (cc1 == null || cc2 == null) return null;
      componentSum = cc1 * weights.cc1 + cc2 * weights.cc2;
      break;
    case GPATemplateType.B:
      if (cc1 == null || cc2 == null || cc3 == null) return null;
      componentSum = cc1 * weights.cc1 + cc2 * weights.cc2 + cc3 * (weights.cc3 || 0);
      break;
    case GPATemplateType.C:
      if (cc1 == null || cc2 == null) return null;
      componentSum = cc1 * weights.cc1 + cc2 * weights.cc2;
      break;
    default:
      return null;
  }

  // targetMin = componentSum + finalScore * weights.final
  // finalScore = (targetMin - componentSum) / weights.final
  const requiredFinal = (targetMin - componentSum) / weights.final;

  if (requiredFinal > 10.0) return null; // Không thể đạt
  if (requiredFinal < 0) return 0; // Đã đủ rồi

  return roundTo1Decimal(Math.ceil(requiredFinal * 10) / 10); // Làm tròn lên
}

// ────────────────────────────────────────
// 7. GPA KỲ VỌNG (Target GPA Projection)
// ────────────────────────────────────────

/**
 * Ánh xạ GPA yêu cầu → Điểm chữ tối thiểu trung bình
 * Dựa trên GRADE_SCALE của ĐHQGHN
 */
export function getMinimumGradeForGPA(gpa: number): string {
  if (gpa >= 3.7) return 'A';
  if (gpa >= 3.5) return 'B+';
  if (gpa >= 3.0) return 'B';
  if (gpa >= 2.5) return 'C+';
  if (gpa >= 2.0) return 'C';
  if (gpa >= 1.5) return 'D+';
  if (gpa >= 1.0) return 'D';
  return 'D';
}

/**
 * Tính toán GPA Projection chi tiết cho tính năng "GPA Kỳ vọng"
 * 
 * Input:
 *   - semesters: tất cả học kỳ đã có
 *   - targetGPA: GPA mục tiêu tốt nghiệp (VD: 3.6)
 *   - totalTargetCredits: tổng TC cần để tốt nghiệp (VD: 135)
 *   - remainingSemesters: số kỳ còn lại ước tính
 *
 * Output: GPAProjection object chứa toàn bộ phân tích
 */
export function calculateGPAProjection(
  semesters: GPASemester[],
  targetGPA: number,
  totalTargetCredits: number,
  remainingSemesters: number
): GPAProjection {
  // 1. Tính GPA tích lũy hiện tại và tổng TC đã tích lũy
  const cumulativeGPA = calculateCumulativeGPA(semesters);
  const allCourses = collectAllCoursesWithRetakesPublic(semesters);
  const currentCredits = allCourses
    .filter(c => {
      const computed = c.computed || computeCourse(c);
      return computed.passed;
    })
    .reduce((sum, c) => sum + c.credits, 0);

  const remainingCredits = Math.max(totalTargetCredits - currentCredits, 0);

  // 2. Base case: chưa có dữ liệu
  if (cumulativeGPA == null || currentCredits === 0) {
    return {
      targetGPA,
      currentGPA: null,
      currentCredits: 0,
      remainingCredits: totalTargetCredits,
      remainingSemesters,
      requiredGPAPerSemester: null,
      requiredMinGrade: null,
      isFeasible: true,
      feasibilityNote: 'Chưa có dữ liệu điểm. Hãy nhập ít nhất 1 học kỳ.',
      alreadyAchieved: false,
      progressPercent: 0,
    };
  }

  // 3. Đã tốt nghiệp hết TC
  if (remainingCredits <= 0) {
    const achieved = cumulativeGPA >= targetGPA;
    return {
      targetGPA,
      currentGPA: cumulativeGPA,
      currentCredits,
      remainingCredits: 0,
      remainingSemesters: 0,
      requiredGPAPerSemester: null,
      requiredMinGrade: null,
      isFeasible: achieved,
      feasibilityNote: achieved
        ? `Bạn đã đạt mục tiêu GPA ${targetGPA.toFixed(2)}! Chúc mừng!`
        : `Bạn đã hoàn thành TC nhưng GPA hiện tại (${cumulativeGPA.toFixed(2)}) chưa đạt mục tiêu ${targetGPA.toFixed(2)}.`,
      alreadyAchieved: achieved,
      progressPercent: Math.min((cumulativeGPA / targetGPA) * 100, 100),
    };
  }

  // 4. Đã đạt mục tiêu rồi
  if (cumulativeGPA >= targetGPA) {
    // Tính GPA tối thiểu để DUY TRÌ mục tiêu
    const maintainGPA = calculateRequiredGPA(cumulativeGPA, currentCredits, targetGPA, remainingCredits);
    return {
      targetGPA,
      currentGPA: cumulativeGPA,
      currentCredits,
      remainingCredits,
      remainingSemesters,
      requiredGPAPerSemester: maintainGPA,
      requiredMinGrade: maintainGPA != null ? getMinimumGradeForGPA(maintainGPA) : null,
      isFeasible: true,
      feasibilityNote: maintainGPA != null && maintainGPA <= 0
        ? `Tuyệt vời! Bạn đã đạt GPA ${cumulativeGPA.toFixed(2)}, vượt mục tiêu! Chỉ cần duy trì phong độ.`
        : `Bạn đang đạt mục tiêu! GPA các kỳ tới chỉ cần tối thiểu ${maintainGPA?.toFixed(2)} để duy trì.`,
      alreadyAchieved: true,
      progressPercent: 100,
    };
  }

  // 5. Tính GPA cần thiết cho phần TC còn lại
  const requiredOverall = calculateRequiredGPA(cumulativeGPA, currentCredits, targetGPA, remainingCredits);

  // 5a. Bất khả thi (cần > 4.0)
  if (requiredOverall == null || requiredOverall > 4.0) {
    // Tính GPA tối đa có thể đạt được
    const maxPossibleGPA = roundTo2Decimal(
      (cumulativeGPA * currentCredits + 4.0 * remainingCredits) / (currentCredits + remainingCredits)
    );
    return {
      targetGPA,
      currentGPA: cumulativeGPA,
      currentCredits,
      remainingCredits,
      remainingSemesters,
      requiredGPAPerSemester: null,
      requiredMinGrade: null,
      isFeasible: false,
      feasibilityNote: `Không thể đạt GPA ${targetGPA.toFixed(2)}. Ngay cả khi đạt toàn A+ (4.0) cho ${remainingCredits} TC còn lại, GPA tối đa chỉ đạt ${maxPossibleGPA.toFixed(2)}. Hãy điều chỉnh mục tiêu.`,
      alreadyAchieved: false,
      progressPercent: roundTo2Decimal((cumulativeGPA / targetGPA) * 100),
    };
  }

  // 6. Khả thi — tính chi tiết per-semester
  const requiredPerSemester = roundTo2Decimal(requiredOverall); // Mỗi kỳ đều phải đạt mức này
  const minGrade = getMinimumGradeForGPA(requiredPerSemester);

  // 7. Đánh giá mức độ khả thi
  let feasibilityNote: string;
  if (requiredPerSemester >= 3.8) {
    feasibilityNote = `Rất thách thức! Bạn phải đạt gần như toàn A (≥ ${requiredPerSemester.toFixed(2)}) mỗi kỳ. Cần nỗ lực tối đa!`;
  } else if (requiredPerSemester >= 3.5) {
    feasibilityNote = `Thách thức nhưng khả thi! GPA mỗi kỳ cần ≥ ${requiredPerSemester.toFixed(2)}. Tập trung hết sức!`;
  } else if (requiredPerSemester >= 3.0) {
    feasibilityNote = `Hoàn toàn khả thi! Duy trì GPA ≥ ${requiredPerSemester.toFixed(2)} mỗi kỳ là đạt mục tiêu.`;
  } else if (requiredPerSemester >= 2.0) {
    feasibilityNote = `Dễ dàng đạt được! Chỉ cần duy trì GPA ≥ ${requiredPerSemester.toFixed(2)} mỗi kỳ.`;
  } else {
    feasibilityNote = `Rất dễ! GPA yêu cầu thấp (${requiredPerSemester.toFixed(2)}). Bạn gần như chắc chắn đạt mục tiêu.`;
  }

  return {
    targetGPA,
    currentGPA: cumulativeGPA,
    currentCredits,
    remainingCredits,
    remainingSemesters,
    requiredGPAPerSemester: requiredPerSemester,
    requiredMinGrade: minGrade,
    isFeasible: true,
    feasibilityNote,
    alreadyAchieved: false,
    progressPercent: roundTo2Decimal((cumulativeGPA / targetGPA) * 100),
  };
}

/**
 * Public wrapper cho collectAllCoursesWithRetakes
 */
function collectAllCoursesWithRetakesPublic(semesters: GPASemester[]): GPACourse[] {
  const allCourses: GPACourse[] = [];
  const retakenIds = new Set<string>();
  for (const sem of semesters) {
    for (const course of sem.courses) {
      if (course.retake_of) retakenIds.add(course.retake_of);
    }
  }
  for (const sem of semesters) {
    for (const course of sem.courses) {
      if (!retakenIds.has(course.id)) allCourses.push(course);
    }
  }
  return allCourses;
}

// ────────────────────────────────────────
// UTILITY FUNCTIONS
// ────────────────────────────────────────

function roundTo1Decimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundTo2Decimal(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Validate điểm nhập vào (0.0 – 10.0)
 */
export function validateScore(value: number | null | undefined): boolean {
  if (value == null || value === undefined) return true; // Empty is OK
  return value >= 0 && value <= 10;
}

/**
 * Validate tín chỉ (1 – 10)
 */
export function validateCredits(credits: number): boolean {
  return Number.isInteger(credits) && credits >= 1 && credits <= 10;
}
