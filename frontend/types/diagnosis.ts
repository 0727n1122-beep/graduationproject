// ============================================================
// Minifi 진단 결과 타입 정의
// 아쿠아 목업(minifi-diagnosis-mockup)의 데이터 모양에서 추출.
// 백엔드 /optimize 응답 스키마가 이 모양으로 오면 바로 연결 가능.
// ------------------------------------------------------------
// 구성:
//   1) 백엔드에서 받는 순수 데이터 (API 응답)
//   2) 프론트가 런타임에 얹는 상태 (status, on 등)
// tmpl 같은 함수 필드는 프론트 로직이라 API 스키마에서 제외.
// ============================================================

// ─────────────────────────────────────────
// 1. 이슈 카테고리
// ─────────────────────────────────────────

/** 문제 유형. 목업 CAT의 키와 1:1 대응. */
export type IssueCategory =
  | "filler" // 불필요한 군더더기
  | "redundant" // 중복 표현
  | "ambiguous" // 모호한 지시
  | "monolithic"; // 한 번에 너무 많음

/** 카테고리 표시용 메타. 목업 CAT = { filler: { name }, ... } */
export interface CategoryMeta {
  name: string;
}
export type CategoryMap = Record<IssueCategory, CategoryMeta>;

// ─────────────────────────────────────────
// 2. 본문 세그먼트 (텍스트 + 밑줄 이슈)
// ─────────────────────────────────────────
// 프롬프트 본문을 순서대로 자른 조각들.
// t:"text" = 그냥 텍스트, t:"issue" = 밑줄 그을 문제 구간.
// span 직접 구현 방식이라 이 배열을 순서대로 렌더링하면 됨.

/** 문제 없는 일반 텍스트 조각 */
export interface TextSegment {
  t: "text";
  text: string;
}

/** monolithic 이슈를 쪼갤 때 보여주는 분해 단계 */
export interface SplitStep {
  title: string;
  desc: string;
}

/** 밑줄 그을 문제 구간 (백엔드 응답) */
export interface IssueSegment {
  t: "issue";
  cat: IssueCategory;
  /** 원문에서 밑줄 칠 실제 텍스트 */
  text: string;
  /**
   * 치환 텍스트.
   *  - 문자열: 이 텍스트로 교체
   *  - "":     빈 문자열로 교체(사실상 삭제, del과 함께 옴)
   *  - null:   단순 치환이 아님(monolithic처럼 구조 분해가 필요한 경우)
   */
  repl: string | null;
  /** 이 이슈를 해결하면 줄어드는 토큰 수 */
  tok: number;
  /** 이 이슈를 해결하면 줄어드는 예상 반복(iteration) 횟수 */
  iter: number;
  /** 밑줄 클릭 시 팝오버에 뜨는 설명(왜 문제인지) */
  why: string;

  // ── 선택 필드 ──
  /** filler 등에서 "삭제"임을 표시 */
  del?: boolean;
  /** monolithic처럼 치환이 아니라 구조를 바꿔야 하는 이슈 */
  structural?: boolean;
  /** monolithic 분해 시 얻는 추가 토큰 절감 보너스 */
  monoBonus?: number;
  /** monolithic을 쪼갠 하위 작업 단계들 */
  steps?: SplitStep[];
}

/** 본문 세그먼트 = 텍스트 or 이슈 */
export type Segment = TextSegment | IssueSegment;

// ─────────────────────────────────────────
// 3. 누락 조건(missing) — 추가하면 좋은 조건들
// ─────────────────────────────────────────
// 목업의 MISS 배열. 확신도(conf)에 따라 UI가 달라짐:
//   high/rec → 값 직접 입력 + 토글
//   low      → 옵션 버튼 중 택1

/** 누락 조건의 확신도 */
export type MissConfidence =
  | "high" // 감지: 거의 확실히 필요
  | "rec" // 추천: 넣으면 좋음
  | "low"; // 선택: 원하면 추가

/** low 확신도일 때 고르는 옵션 하나 */
export interface MissOption {
  label: string;
  /** 선택된 값. "제한 없음" 같은 경우 null */
  value: string | null;
  /** 이 옵션을 고르면 프롬프트에 삽입될 최종 문구. null이면 삽입 안 함 */
  phrase: string | null;
}

/** 누락 조건 한 줄 (백엔드 응답) */
export interface MissingCondition {
  label: string;
  conf: MissConfidence;
  /** high/rec의 기본값. 없으면 null */
  value: string | null;
  /** 이 조건 추가 시 늘어나는 토큰 */
  tok: number;
  /** 이 조건 추가 시 늘어나는 반복 횟수 */
  iter: number;
  /** low일 때 제공되는 선택지 */
  options?: MissOption[];
}

// ─────────────────────────────────────────
// 4. 시나리오 = /optimize 한 건의 전체 응답
// ─────────────────────────────────────────

export interface DiagnosisResult {
  id: string;
  label: string;
  /** 진단 날짜 (MM/DD). 히스토리 목록용 */
  date: string;
  /** 히스토리에서 이미 해결한 이슈 수 */
  histResolved: number;
  /** 원본 프롬프트 토큰 수 */
  baseToken: number;
  /** 원본 예상 반복 횟수 */
  baseIter: number;
  /** 본문 세그먼트 배열 */
  segments: Segment[];
  /** 누락 조건 배열 */
  miss: MissingCondition[];
}

// ============================================================
// 5. 프론트 런타임 상태 (백엔드 응답 X, 화면에서 얹는 값)
// ============================================================
// 사용자가 밑줄을 눌러 적용/건너뛰기 하면서 생기는 상태.
// API 응답을 받은 뒤 프론트에서 확장해 쓰는 형태.

/** 이슈 세그먼트의 처리 상태 */
export type IssueStatus = "applied" | "skipped" | undefined;

/** 화면에서 다루는 이슈 (응답 + 상태) */
export interface IssueSegmentState extends IssueSegment {
  status?: IssueStatus;
}

/** 화면에서 다루는 누락 조건 (응답 + 상태 + 조합된 문구) */
export interface MissingConditionState extends MissingCondition {
  /** 이 조건을 켰는지 */
  on: boolean;
  /** 현재 선택/입력된 값 (사용자가 바꿀 수 있음) */
  value: string | null;
  /** value로 조합된 실제 삽입 문구. tmpl(value)의 결과 */
  phrase?: string | null;
  /** high/rec에서 value → phrase로 만드는 함수 (프론트 전용, 응답엔 없음) */
  tmpl?: (value: string) => string;
}

/** monolithic 분해 단계의 on/off 상태 */
export interface MonoStepState extends SplitStep {
  on: boolean;
}

// ============================================================
// 6. DiagnosisCards 컴포넌트 Props (예시)
// ============================================================

export interface DiagnosisCardProps {
  /** 밑줄 클릭 시 뜨는 팝오버가 다루는 이슈 */
  issue: IssueSegmentState;
  category: CategoryMeta;
  /** "적용" 눌렀을 때 */
  onApply: (issue: IssueSegmentState) => void;
  /** "건너뛰기" 눌렀을 때 */
  onSkip: (issue: IssueSegmentState) => void;
  /** ambiguous 등에서 사용자가 치환 텍스트를 직접 고칠 때 */
  onEditReplacement?: (issue: IssueSegmentState, next: string) => void;
}
