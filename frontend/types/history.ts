// ============================================================
// Minifi 첨삭 히스토리 타입 정의
// 백엔드 backend/history.py의 HistoryResponse와 1:1 대응.
// (docs/minifi-diagnosis-mockup-v4_1.html의 히스토리 뷰는 FIXTURES 예시 데이터를
// 썼지만, 여기서는 실제 /history 응답 스키마 기준으로 작성)
// ============================================================

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
  created_at: string;
}
