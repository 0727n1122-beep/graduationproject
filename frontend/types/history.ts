// ============================================================
// Minifi 첨삭 히스토리 타입 정의
// 백엔드 backend/history.py의 HistoryResponse와 1:1 대응.
// (docs/minifi-diagnosis-mockup-v4_1.html의 히스토리 뷰는 FIXTURES 예시 데이터를
// 썼지만, 여기서는 실제 /history 응답 스키마 기준으로 작성)
// ============================================================

import type { Issue, MissingConstraint } from "@/types/diagnosis";

/** 그때 진단했던 issues/missing_constraints/feedback 원본. "기록 보기"에서
 *  /optimize를 다시 호출하지 않고 DiagnosisCards로 그대로 재현하는 데 씀. */
export interface DiagnosisDetail {
  issues: Issue[];
  missing_constraints: MissingConstraint[];
  feedback: string | null;
}

/** 백엔드 GET /history가 내려주는 히스토리 항목 하나 (최신순으로 이미 정렬됨) */
export interface HistoryItem {
  id: number;
  original_prompt: string;
  optimized_prompt: string;
  original_tokens: number;
  optimized_tokens: number;
  saved_tokens: number;
  saved_percent: number;
  issue_count: number;
  /** 카테고리별 이슈 개수, 예: {"AMBIGUOUS": 2, "CODE_DUMP": 1}. categories 컬럼 추가 이전에 저장된 항목은 null. */
  categories: Record<string, number> | null;
  /** diagnosis_detail 컬럼 추가 이전에 저장된 항목은 null — "기록 보기" 불가 */
  diagnosis_detail: DiagnosisDetail | null;
  created_at: string;
}
