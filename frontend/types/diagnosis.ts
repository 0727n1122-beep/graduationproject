// ============================================================
// Minifi 진단 결과 타입 정의
// docs/minifi_meta_prompt_v5.md(v5 스키마) + docs/minifi-diagnosis-mockup-v4_1.html의
// engine.js 로직을 기준으로 백엔드 /optimize 실제 응답 모양에 맞춰 작성.
// ------------------------------------------------------------
// 구성:
//   1) 백엔드에서 받는 순수 데이터 (API 응답)
//   2) 프론트가 런타임에 얹는 상태 (status, on 등)
// ============================================================

// ─────────────────────────────────────────
// 1. 이슈 카테고리
// ─────────────────────────────────────────

/** 문제 유형. 백엔드 GUIDES 딕셔너리 키와 1:1 대응 (MISSING_CONSTRAINT 제외 — 별도 배열). */
export type IssueCategory =
  | "AMBIGUOUS" // 모호한 지시어
  | "FILLER" // 불필요한 군더더기
  | "REDUNDANT" // 중복 표현
  | "CODE_DUMP" // 코드 전체 전송
  | "UNSTRUCTURED" // 흩어진 요구사항
  | "MONOLITHIC_REQUEST"; // 분할 없는 통합 요청

/** inline(그 자리에서 편집) vs structural(별도 패널). structural은 MONOLITHIC_REQUEST뿐. */
export type IssueScope = "inline" | "structural";

/** 카테고리 표시용 한글 이름 */
export const CATEGORY_NAME: Record<IssueCategory, string> = {
  FILLER: "불필요한 군더더기",
  REDUNDANT: "중복 표현",
  AMBIGUOUS: "모호한 지시",
  CODE_DUMP: "코드 그대로 붙여넣기",
  UNSTRUCTURED: "요구사항 정리 안 됨",
  MONOLITHIC_REQUEST: "한 번에 너무 많음",
};

// ─────────────────────────────────────────
// 2. issue (백엔드 /optimize 응답의 issues[] 원소)
// ─────────────────────────────────────────

/** MONOLITHIC_REQUEST 분해 단계 (steps[] 원소) */
export interface MonoStep {
  title: string;
  desc: string;
  /** 이 단계가 끝났다는 걸 확인하는 방법. verify 필드 추가 이전에 저장된 히스토리 기록엔 없을 수 있음 */
  verify?: string;
}

/** 카테고리별 가이드 (백엔드가 issue에 얹어 보냄). 현재 팝오버 UI에서는 미사용. */
export interface IssueGuide {
  title: string;
  tip: string;
  example_bad: string;
  example_good: string;
}

/** RAG 검색으로 찾은 근거 청크 (rag/chunks.json 출처). 근거가 없는 카테고리(FILLER/REDUNDANT
 *  등)나 검색 실패 시에는 없음(undefined/null) — 근거 없이 인용을 지어내지 않는다. */
export interface SourceCitation {
  doc: string;
  section: string;
  url: string;
  quote: string;
}

/** 백엔드가 내려주는 이슈 원본 (issues[] 원소) */
export interface Issue {
  id: string;
  category: IssueCategory;
  scope: IssueScope;
  /** 원문의 verbatim 부분문자열. 프론트가 occurrence와 함께 위치를 찾는 데 사용 */
  snippet: string;
  /** 동일 snippet이 여러 번 나올 때 몇 번째(0-based)인지 */
  occurrence: number;
  /** 왜 문제인지, 한 문장 */
  explanation: string;
  /** scope:"inline"만 존재. "" = 삭제, null = 단순 치환 아님(구조적 이슈에서만) */
  replacement: string | null;
  /** scope:"structural"(MONOLITHIC_REQUEST)만 존재 */
  steps: MonoStep[] | null;
  guide?: IssueGuide;
  source?: SourceCitation[] | null;
}

// ─────────────────────────────────────────
// 3. 본문 세그먼트 (텍스트 + 밑줄 이슈)
// ─────────────────────────────────────────
// 프롬프트 원문을 순서대로 자른 조각들. 위치는 engine의 resolvePositions가 계산.

/** 위치(start/end)가 계산되고 런타임 상태(적용/건너뛰기 등)가 얹힌 이슈 */
export interface IssueState extends Issue {
  start: number;
  end: number;
  status?: "applied" | "skipped";
  /** AMBIGUOUS에서 사용자가 replacement를 직접 고친 경우 */
  editedReplacement?: string;
  /** MONOLITHIC_REQUEST 단계별 on/off 런타임 상태 */
  monoSteps?: MonoStepState[];
}

export interface MonoStepState extends MonoStep {
  on: boolean;
}

export interface TextSegment {
  type: "text";
  text: string;
}

export interface IssueSegment {
  type: "issue";
  issue: IssueState;
}

export type Segment = TextSegment | IssueSegment;

// ─────────────────────────────────────────
// 4. missing_constraints — MISSING_CONSTRAINT 전용 배열
// ─────────────────────────────────────────

export type MissingConfidence = "high" | "rec" | "low";

/** low 확신도일 때 고르는 옵션 하나 */
export interface MissingOption {
  label: string;
  /** 이 옵션을 고르면 프롬프트에 삽입될 최종 문구. null이면 삽입 안 함("제한 없음" 등) */
  phrase: string | null;
}

/** 백엔드가 내려주는 누락 조건 원본 (missing_constraints[] 원소) */
export interface MissingConstraint {
  id: string;
  field: string;
  confidence: MissingConfidence;
  suggested_value: string | null;
  suggested_phrase: string | null;
  options: MissingOption[] | null;
  source?: SourceCitation[] | null;
}

/** 화면에서 다루는 누락 조건 (원본 + 상태) */
export interface MissingConstraintState extends MissingConstraint {
  /** 이 조건을 켰는지 */
  on: boolean;
  /** 현재 삽입될 문구 (직접 편집 가능) */
  phrase: string | null;
  /** low 확신도에서 선택한 옵션 인덱스 */
  selectedOption: number | null;
}

// ─────────────────────────────────────────
// 5. /optimize 응답 전체 (백엔드 main.py 반환 그대로)
// ─────────────────────────────────────────

export interface CostEstimate {
  before: number;
  after: number;
}

export interface OptimizeResponse {
  original_tokens: number;
  optimized_tokens: number;
  saved_tokens: number;
  saved_percent: number;
  optimized_prompt: string;
  issues: Issue[];
  missing_constraints: MissingConstraint[];
  feedback: string | null;
  costs: Record<string, CostEstimate>;
}

// ─────────────────────────────────────────
// 6. DiagnosisCards 컴포넌트 Props
// ─────────────────────────────────────────

export interface DiagnosisCardsProps {
  /** 사용자가 실제로 제출한 원본 프롬프트 (API 응답엔 없음 — 프론트가 보관) */
  prompt: string;
  /** /optimize 응답 */
  result: OptimizeResponse;
  /** 상단 eyebrow 라벨. 기본값 "03 · 첨삭 노트" */
  eyebrow?: string;
  /** 이 진단의 부제 (예: 어떤 요청인지). 없으면 생략 */
  subtitle?: string;
}
