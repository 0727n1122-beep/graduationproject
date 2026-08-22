// ============================================================
// domain_qa_list_v5.md의 30개 프롬프트를 v5 스키마(/optimize 응답 형태)로
// 재구성한 테스트 픽스처. 실제 Claude API 대신 이 데이터로 프론트 로직을 검증한다.
// snippet은 반드시 prompt의 verbatim 부분문자열이어야 하며, 이는
// test_engine.mjs가 기계적으로 검증한다(육안 확인에 의존하지 않음).
// ============================================================

// ============================================================
// CODE_DUMP용 코드 블록 상수 — snippet(원본 그대로)과 replacement(진단문구+코드 보존)
// 양쪽에서 재사용해서 오탈자로 인한 verbatim 불일치를 원천 차단한다.
// ============================================================
const CD01_FUNC = "function checkout(cart) {\n" +
  "  let total = 0;\n" +
  "  for (let i = 0; i < cart.length; i++) {\n" +
  "    total += cart[i].price;\n" +
  "  }\n" +
  "  return total.toFixed(2);\n" +
  "}";
const CD01_CODE_WITH_ERROR = CD01_FUNC + "\n\ncheckout(null)\n\nTypeError: Cannot read properties of null (reading 'length')";

const CD02_CLASS = "class UserManager:\n" +
  "    def __init__(self):\n" +
  "        self.users = []\n" +
  "    def add_user(self, name, email):\n" +
  "        self.users.append({\"name\": name, \"email\": email})\n" +
  "    def find_user(self, email):\n" +
  "        for u in self.users:\n" +
  "            if u[\"email\"] == email:\n" +
  "                return u\n" +
  "        return None\n" +
  "    def remove_user(self, email):\n" +
  "        self.users = [u for u in self.users if u[\"email\"] != email]";

const CD03_COMPONENT = "function SignupForm() {\n" +
  "  const [email, setEmail] = useState(\"\");\n" +
  "  const [password, setPassword] = useState(\"\");\n" +
  "  const [confirm, setConfirm] = useState(\"\");\n" +
  "  const [error, setError] = useState(\"\");\n\n" +
  "  function handleSubmit(e) {\n" +
  "    if (password !== confirm) {\n" +
  "      setError(\"비밀번호가 일치하지 않습니다.\");\n" +
  "      return;\n" +
  "    }\n" +
  "    fetch(\"/api/signup\", {\n" +
  "      method: \"POST\",\n" +
  "      headers: { \"Content-Type\": \"application/json\" },\n" +
  "      body: JSON.stringify({ email, password }),\n" +
  "    });\n" +
  "  }\n\n" +
  "  return (\n" +
  "    <form onSubmit={handleSubmit}>\n" +
  "      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder=\"이메일\" />\n" +
  "      <input value={password} onChange={(e) => setPassword(e.target.value)} type=\"password\" placeholder=\"비밀번호\" />\n" +
  "      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type=\"password\" placeholder=\"비밀번호 확인\" />\n" +
  "      {error && <p>{error}</p>}\n" +
  "      <button type=\"submit\">가입하기</button>\n" +
  "    </form>\n" +
  "  );\n" +
  "}";

const CD04_SCRIPT = "import pandas as pd\n" +
  "df = pd.read_csv(\"sales.csv\")\n" +
  "df['date'] = pd.to_datetime(df['date'])\n" +
  "monthly = df.groupby(df['date'].dt.month)['revenue'].sum()\n" +
  "print(monthly.plot())";
const CD04_CODE_WITH_ERROR = CD04_SCRIPT + "\n\nKeyError: 'revenue'";

const CD05_QUERY = "SELECT customer_id, SUM(amount) as total\n" +
  "FROM orders\n" +
  "WHERE order_date >= '2026-01-01'\n" +
  "GROUP BY customer_id\n" +
  "HAVING total > 100000\n" +
  "ORDER BY total DESC";

const FIXTURES = [

  // ── CODE_DUMP (5) ──────────────────────────────────────────
  // v5 수정: replacement가 코드를 요약으로 "대체"하지 않는다. 다음 턴에서 실제로 코드를
  // 고쳐야 하는데 원본이 사라지면 그 수정 자체가 불가능해지기 때문 — 진단 문구를 코드
  // 위에 붙이고, 코드 본문은 verbatim 그대로 유지한다(minifi_meta_prompt_v5.md 4장 참고).
  {
    id: "CD01", group: "CODE_DUMP", domain: "코딩",
    label: "에러 메시지 있는 코드",
    prompt: "이 코드에서 자꾸 에러가 나요 고쳐주세요.\n\n" + CD01_CODE_WITH_ERROR,
    issues: [{
      category: "CODE_DUMP", scope: "inline", occurrence: 0,
      snippet: CD01_CODE_WITH_ERROR,
      explanation: "코드와 에러 메시지를 통째로 보내면 토큰만 늘어요. 원인만 진단해서 코드 위에 붙이고, 코드는 그대로 남겨드릴게요.",
      replacement: "[진단] cart의 length에 접근하기 전 null 체크가 없어 checkout(null) 호출 시 TypeError가 발생함\n\n" + CD01_FUNC,
      _testExpectCodeFragment: CD01_FUNC,
    }],
    missing_constraints: [],
  },
  {
    id: "CD02", group: "CODE_DUMP", domain: "코딩",
    label: "에러 메시지 없는 코드 리뷰 요청",
    prompt: "이 코드 리뷰 좀 해주세요.\n\n" + CD02_CLASS,
    issues: [{
      category: "CODE_DUMP", scope: "inline", occurrence: 0,
      snippet: CD02_CLASS,
      explanation: "에러 없이 코드만 붙여넣으면, 무엇을 하는 코드인지 한 줄로 설명해서 코드 위에 붙여드려요. 코드는 그대로 유지돼요.",
      replacement: "[코드 설명] 사용자를 목록에 추가·이메일로 검색·삭제하는 UserManager 클래스(add_user/find_user/remove_user)\n\n" + CD02_CLASS,
      _testExpectCodeFragment: CD02_CLASS,
    }],
    missing_constraints: [],
  },
  {
    id: "CD03", group: "CODE_DUMP", domain: "코딩",
    label: "대량 코드 + 특정 부분만 문제 (snippet 길이제한 예외 확인)",
    // 원문 QA 리스트엔 "90줄 컴포넌트 코드 전체 첨부"로만 서술돼 있어, 동일 취지의
    // 축약 버전(핵심 버그 재현 가능한 최소 코드)으로 구성함.
    prompt: "회원가입 폼 컴포넌트인데 제출이 안 돼요.\n\n" + CD03_COMPONENT,
    issues: [{
      category: "CODE_DUMP", scope: "inline", occurrence: 0,
      snippet: CD03_COMPONENT,
      explanation: "코드 전체를 그대로 보내면 토큰만 늘어요. 90줄이 넘어가도 snippet 길이 제한 없이 코드는 전부 보존하고, 진단 한 줄만 앞에 붙여드려요.",
      replacement: "[코드 설명] handleSubmit에 e.preventDefault()가 없어 제출 시 페이지가 새로고침되는 것으로 보이는 회원가입 폼 컴포넌트\n\n" + CD03_COMPONENT,
      _testExpectCodeFragment: CD03_COMPONENT,
    }],
    missing_constraints: [],
  },
  {
    id: "CD04", group: "CODE_DUMP", domain: "데이터분석",
    label: "pandas 전처리 코드 + 에러",
    prompt: "이 전처리 코드 실행하면 에러나요.\n\n" + CD04_CODE_WITH_ERROR,
    issues: [{
      category: "CODE_DUMP", scope: "inline", occurrence: 0,
      snippet: CD04_CODE_WITH_ERROR,
      explanation: "코드와 에러를 통째로 보내는 대신, 컬럼명 문제가 원인이라는 걸 진단해서 코드 위에 붙이고 코드는 그대로 남겨드려요.",
      replacement: "[진단] date 컬럼 기준으로 월별 revenue를 합산하려 했으나 CSV에 revenue 컬럼이 없어 KeyError가 발생함\n\n" + CD04_SCRIPT,
      _testExpectCodeFragment: CD04_SCRIPT,
    }],
    missing_constraints: [],
  },
  {
    id: "CD05", group: "CODE_DUMP", domain: "데이터분석",
    label: "SQL 쿼리 전체, 에러 없음",
    prompt: "이 쿼리 결과가 이상하게 나와요. 확인해주세요.\n\n" + CD05_QUERY,
    issues: [{
      category: "CODE_DUMP", scope: "inline", occurrence: 0,
      snippet: CD05_QUERY,
      explanation: "에러 메시지가 없으니, 쿼리가 무엇을 하는지 한 줄로 설명해서 위에 붙이고 쿼리 본문은 그대로 유지해요.",
      replacement: "[코드 설명] 2026년 이후 주문 중 고객별 합계 금액이 10만 원을 초과하는 고객을 합계 내림차순으로 조회하는 쿼리\n\n" + CD05_QUERY,
      _testExpectCodeFragment: CD05_QUERY,
    }],
    missing_constraints: [],
  },

  // ── MONOLITHIC_REQUEST (4) ────────────────────────────────
  {
    id: "MO01", group: "MONOLITHIC_REQUEST", domain: "코딩",
    label: "블로그 (4개 기능)",
    prompt: "블로그 사이트 만들어주세요. 글쓰기 기능이랑, 댓글 기능이랑, 좋아요 기능이랑,\n태그별 검색 기능까지 다 필요해요.",
    issues: [{
      category: "MONOLITHIC_REQUEST", scope: "structural", occurrence: 0,
      snippet: "글쓰기 기능이랑, 댓글 기능이랑, 좋아요 기능이랑,\n태그별 검색 기능까지 다 필요해요.",
      explanation: "독립적으로 검증 가능한 기능이 4개예요. 아래에서 순서대로 나눌 수 있어요.",
      replacement: null,
      steps: [
        { title: "글쓰기 기능", desc: "제목·본문 작성 및 저장" },
        { title: "댓글 기능", desc: "게시글에 댓글 작성·조회" },
        { title: "좋아요 기능", desc: "게시글별 좋아요 토글·집계" },
        { title: "태그별 검색 기능", desc: "태그로 게시글 필터링 조회" },
      ],
    }],
    missing_constraints: [],
  },
  {
    id: "MO02", group: "MONOLITHIC_REQUEST", domain: "데이터분석",
    label: "데이터 파이프라인 (4단계)",
    prompt: "데이터 분석 파이프라인 만들어주세요. CSV 파일 수집하는 것부터, 전처리하고,\n시각화 차트 만들고, 매주 자동으로 리포트 생성해서 이메일로 보내는 것까지요.",
    issues: [{
      category: "MONOLITHIC_REQUEST", scope: "structural", occurrence: 0,
      snippet: "CSV 파일 수집하는 것부터, 전처리하고,\n시각화 차트 만들고, 매주 자동으로 리포트 생성해서 이메일로 보내는 것까지요.",
      explanation: "수집·전처리·시각화·자동발송은 각각 독립적으로 검증 가능한 기능이에요.",
      replacement: null,
      steps: [
        { title: "CSV 수집", desc: "지정 경로 또는 업로드로 CSV 파일 읽기" },
        { title: "전처리", desc: "결측치 처리, 타입 변환 등 정제" },
        { title: "시각화 차트 생성", desc: "정제된 데이터로 차트 렌더링" },
        { title: "주간 자동 리포트 발송", desc: "매주 리포트를 생성해 이메일로 발송" },
      ],
    }],
    missing_constraints: [],
  },
  {
    id: "MO03", group: "MONOLITHIC_REQUEST", domain: "데이터분석",
    label: "대시보드 (4개 기능)",
    prompt: "대시보드 만들어주세요. 매출 차트 보여주고, 재고 부족하면 알림 오고,\n고객을 그룹별로 나눠서 보여주고, 리포트도 자동으로 만들어졌으면 해요.",
    issues: [{
      category: "MONOLITHIC_REQUEST", scope: "structural", occurrence: 0,
      snippet: "매출 차트 보여주고, 재고 부족하면 알림 오고,\n고객을 그룹별로 나눠서 보여주고, 리포트도 자동으로 만들어졌으면 해요.",
      explanation: "독립적으로 검증 가능한 기능이 4개예요. 아래에서 순서대로 나눌 수 있어요.",
      replacement: null,
      steps: [
        { title: "매출 차트", desc: "기간별 매출 추이 시각화" },
        { title: "재고 부족 알림", desc: "임계치 이하 재고 발생 시 알림" },
        { title: "고객 그룹 분류", desc: "기준에 따라 고객을 그룹으로 분류해 표시" },
        { title: "자동 리포트 생성", desc: "주기적으로 요약 리포트 생성" },
      ],
    }],
    missing_constraints: [],
  },
  {
    id: "MO04", group: "MONOLITHIC_REQUEST", domain: "코딩",
    label: "일정관리 앱 (4개 기능)",
    prompt: "일정관리 앱 만들어줘. 캘린더로 보여주고, 알림 오고, 다른 사람이랑 공유되고,\n반복 일정도 설정할 수 있게.",
    issues: [{
      category: "MONOLITHIC_REQUEST", scope: "structural", occurrence: 0,
      snippet: "캘린더로 보여주고, 알림 오고, 다른 사람이랑 공유되고,\n반복 일정도 설정할 수 있게.",
      explanation: "독립적으로 검증 가능한 기능이 4개예요. 아래에서 순서대로 나눌 수 있어요.",
      replacement: null,
      steps: [
        { title: "캘린더 뷰", desc: "일정을 달력 형태로 표시" },
        { title: "알림", desc: "일정 시작 전 알림 발송" },
        { title: "공유 기능", desc: "다른 사용자와 일정 공유" },
        { title: "반복 일정", desc: "주기적으로 반복되는 일정 설정" },
      ],
    }],
    missing_constraints: [],
  },

  // ── UNSTRUCTURED (4) — 단일 기능, scope는 반드시 inline ──
  {
    id: "UN01", group: "UNSTRUCTURED", domain: "코딩",
    label: "로그인 기능 하나 (요구사항 흩어짐)",
    prompt: "로그인 기능 만들건데 이메일로 로그인 되고, 비밀번호 찾기도 되고,\n구글로 소셜 로그인도 되면 좋겠어요.",
    issues: [{
      category: "UNSTRUCTURED", scope: "inline", occurrence: 0,
      snippet: "로그인 기능 만들건데 이메일로 로그인 되고, 비밀번호 찾기도 되고,\n구글로 소셜 로그인도 되면 좋겠어요.",
      explanation: "하나의 기능에 대한 요구사항이 번호 없이 흩어져 있어요. 정리해서 넣어드려요.",
      replacement: "로그인 기능을 다음 조건으로 만들어주세요 — 1) 이메일 로그인 2) 비밀번호 찾기 3) 구글 소셜 로그인",
    }],
    missing_constraints: [],
  },
  {
    id: "UN02", group: "UNSTRUCTURED", domain: "코딩",
    label: "테이블 컴포넌트 하나",
    prompt: "테이블 컴포넌트 만들어줘. 정렬도 되고, 페이지네이션도 있고, 검색창도 있었으면 해.",
    issues: [{
      category: "UNSTRUCTURED", scope: "inline", occurrence: 0,
      snippet: "테이블 컴포넌트 만들어줘. 정렬도 되고, 페이지네이션도 있고, 검색창도 있었으면 해.",
      explanation: "하나의 컴포넌트에 대한 요구사항이 흩어져 있어요. 번호 리스트로 정리해드려요.",
      replacement: "테이블 컴포넌트를 다음 조건으로 만들어주세요 — 1) 정렬 기능 2) 페이지네이션 3) 검색창",
    }],
    missing_constraints: [],
  },
  {
    id: "UN03", group: "UNSTRUCTURED", domain: "데이터분석",
    label: "막대그래프 하나",
    prompt: "막대그래프 그려줘. 카테고리별로 색깔 다르게 구분되고, 범례도 있고,\n마우스 올리면 정확한 값도 나왔으면 좋겠어.",
    issues: [{
      category: "UNSTRUCTURED", scope: "inline", occurrence: 0,
      snippet: "막대그래프 그려줘. 카테고리별로 색깔 다르게 구분되고, 범례도 있고,\n마우스 올리면 정확한 값도 나왔으면 좋겠어.",
      explanation: "하나의 차트에 대한 요구사항이 흩어져 있어요. 번호 리스트로 정리해드려요.",
      replacement: "막대그래프를 다음 조건으로 그려주세요 — 1) 카테고리별 색상 구분 2) 범례 표시 3) 호버 시 정확한 값 표시",
    }],
    missing_constraints: [],
  },
  {
    id: "UN04", group: "UNSTRUCTURED", domain: "코딩",
    label: "알림 기능 하나",
    prompt: "알림 기능 필요한데, 실시간으로 뜨고, 안 읽은 건 표시되고,\n클릭하면 관련 페이지로 이동했으면 해요.",
    issues: [{
      category: "UNSTRUCTURED", scope: "inline", occurrence: 0,
      snippet: "알림 기능 필요한데, 실시간으로 뜨고, 안 읽은 건 표시되고,\n클릭하면 관련 페이지로 이동했으면 해요.",
      explanation: "하나의 기능에 대한 요구사항이 흩어져 있어요. 번호 리스트로 정리해드려요.",
      replacement: "알림 기능을 다음 조건으로 만들어주세요 — 1) 실시간 표시 2) 읽지 않음 표시 3) 클릭 시 관련 페이지 이동",
    }],
    missing_constraints: [],
  },

  // ── MISSING_CONSTRAINT (4) ────────────────────────────────
  {
    id: "MC01", group: "MISSING_CONSTRAINT", domain: "코딩",
    label: "언어 단서 있음 → high 대상 아님, 다른 조건 위주",
    prompt: "이 함수 리팩토링해줘.\n\n" +
      "def calc(a, b, op):\n" +
      "    if op == \"+\": return a + b\n" +
      "    elif op == \"-\": return a - b",
    issues: [],
    missing_constraints: [
      {
        field: "리팩토링 방향", confidence: "low",
        options: [
          { label: "가독성 위주", phrase: "가독성을 우선해서 리팩토링해주세요." },
          { label: "확장성 위주(연산자 추가 쉽게)", phrase: "새 연산자를 추가하기 쉬운 구조(딕셔너리 매핑 등)로 리팩토링해주세요." },
          { label: "둘 다 균형있게", phrase: null },
        ],
      },
      {
        field: "타입 힌트 사용", confidence: "rec",
        suggested_value: "타입 힌트 추가", suggested_phrase: "타입 힌트를 추가해주세요.",
      },
    ],
  },
  {
    id: "MC02", group: "MISSING_CONSTRAINT", domain: "코딩",
    label: "업계 표준 기본값 존재 → rec",
    prompt: "로그인 API 만들어줘.",
    issues: [],
    missing_constraints: [
      {
        field: "백엔드 언어/프레임워크", confidence: "rec",
        suggested_value: "Node.js + Express", suggested_phrase: "Node.js + Express 기준으로 작성해주세요.",
      },
      {
        field: "인증 방식", confidence: "low",
        options: [
          { label: "세션 기반", phrase: "세션 기반 인증으로 구현해주세요." },
          { label: "JWT", phrase: "JWT 기반 인증으로 구현해주세요." },
          { label: "OAuth 소셜 로그인 포함", phrase: "OAuth 소셜 로그인도 함께 지원해주세요." },
        ],
      },
    ],
  },
  {
    id: "MC03", group: "MISSING_CONSTRAINT", domain: "데이터분석",
    label: "순수 취향 → low",
    prompt: "그래프 그려줘. 색깔이나 스타일은 알아서 예쁘게 해줘.",
    issues: [],
    missing_constraints: [
      {
        field: "차트 종류", confidence: "low",
        options: [
          { label: "막대그래프", phrase: "막대그래프로 그려주세요." },
          { label: "선그래프", phrase: "선그래프로 그려주세요." },
          { label: "파이차트", phrase: "파이차트로 그려주세요." },
        ],
      },
      {
        field: "색상 스킴", confidence: "low",
        options: [
          { label: "기본 팔레트", phrase: "기본 색상 팔레트를 사용해주세요." },
          { label: "파스텔 톤", phrase: "파스텔 톤 색상을 사용해주세요." },
          { label: "단색 그라데이션", phrase: "단색 계열의 그라데이션을 사용해주세요." },
        ],
      },
    ],
  },
  {
    id: "MC04", group: "MISSING_CONSTRAINT", domain: "코딩",
    label: "DB 종류 미지정 → low, 언어는 rec",
    prompt: "회원 정보 저장하는 기능 짜줘.",
    issues: [],
    missing_constraints: [
      {
        field: "DB 종류", confidence: "low",
        options: [
          { label: "관계형(SQL)", phrase: "관계형 데이터베이스(SQL)를 사용해주세요." },
          { label: "NoSQL(MongoDB 등)", phrase: "NoSQL(MongoDB 등)을 사용해주세요." },
          { label: "파일 기반(JSON 등)", phrase: "별도 DB 없이 파일 기반으로 저장해주세요." },
        ],
      },
      {
        field: "백엔드 언어", confidence: "rec",
        suggested_value: "Node.js", suggested_phrase: "Node.js 기준으로 작성해주세요.",
      },
    ],
  },

  // ── AMBIGUOUS (4) ─────────────────────────────────────────
  {
    id: "AM01", group: "AMBIGUOUS", domain: "코딩",
    label: "지시어만 있고 맥락 전무",
    prompt: "이거 왜 안 돼요?",
    issues: [{
      category: "AMBIGUOUS", scope: "inline", occurrence: 0,
      snippet: "이거",
      explanation: "'이거'가 무엇을 가리키는지 알 수 없어 LLM이 엉뚱한 것을 추측할 수 있어요.",
      replacement: "[안 되는 기능/화면/코드를 구체적으로]",
    }],
    missing_constraints: [],
  },
  {
    id: "AM02", group: "AMBIGUOUS", domain: "코딩",
    label: "지시어 + 모호한 대상",
    prompt: "그 부분 좀 고쳐주세요.",
    issues: [{
      category: "AMBIGUOUS", scope: "inline", occurrence: 0,
      snippet: "그 부분",
      explanation: "'그 부분'이 어디를 가리키는지 알 수 없어요.",
      replacement: "[고칠 부분을 구체적으로]",
    }],
    missing_constraints: [],
  },
  {
    id: "AM03", group: "AMBIGUOUS", domain: "데이터분석",
    label: "'정리'의 기준 불명확 (MISSING_CONSTRAINT와 경계 체크포인트)",
    prompt: "이 데이터 좀 정리해주세요.",
    issues: [{
      category: "AMBIGUOUS", scope: "inline", occurrence: 0,
      snippet: "정리해주세요",
      explanation: "'정리'가 결측치 제거인지 형식 통일인지 등 기준이 없어 결과가 매번 달라질 수 있어요.",
      replacement: "결측치를 제거하고 형식을 통일해주세요",
    }],
    missing_constraints: [],
  },
  {
    id: "AM04", group: "AMBIGUOUS", domain: "코딩",
    label: "이전 대화 맥락 의존",
    prompt: "아까 그거 다시 한번 해주세요.",
    issues: [{
      category: "AMBIGUOUS", scope: "inline", occurrence: 0,
      snippet: "아까 그거",
      explanation: "단일 호출에서는 이전 맥락을 알 수 없어 무엇을 다시 해야 하는지 알 수 없어요.",
      replacement: "[이전에 요청했던 작업을 다시 구체적으로]",
    }],
    missing_constraints: [],
  },

  // ── REDUNDANT (4) ─────────────────────────────────────────
  {
    id: "RD01", group: "REDUNDANT", domain: "코딩",
    label: "에러 처리 중복",
    prompt: "에러 처리 꼭 해주시고, 예외 처리도 반드시 넣어주세요.",
    issues: [{
      category: "REDUNDANT", scope: "inline", occurrence: 0,
      snippet: "에러 처리 꼭 해주시고, 예외 처리도 반드시 넣어주세요.",
      explanation: "'에러 처리'와 '예외 처리'는 같은 요구를 두 번 말한 표현이에요.",
      replacement: "에러가 발생하면 예외 처리를 해주세요.",
    }],
    missing_constraints: [],
  },
  {
    id: "RD02", group: "REDUNDANT", domain: "코딩",
    label: "주석 중복",
    prompt: "주석 달아주세요. 그리고 설명하는 주석도 꼭 넣어주세요.",
    issues: [{
      category: "REDUNDANT", scope: "inline", occurrence: 0,
      snippet: "주석 달아주세요. 그리고 설명하는 주석도 꼭 넣어주세요.",
      explanation: "같은 요구(주석)를 두 번 반복해서 말하고 있어요.",
      replacement: "코드에 설명 주석을 달아주세요.",
    }],
    missing_constraints: [],
  },
  {
    id: "RD03", group: "REDUNDANT", domain: "데이터분석",
    label: "결측치 처리 중복",
    prompt: "결측치 처리해주세요. 그리고 빈 값도 꼭 채워주세요.",
    issues: [{
      category: "REDUNDANT", scope: "inline", occurrence: 0,
      snippet: "결측치 처리해주세요. 그리고 빈 값도 꼭 채워주세요.",
      explanation: "'결측치 처리'와 '빈 값 채우기'는 같은 요구예요.",
      replacement: "결측치를 채워주세요.",
    }],
    missing_constraints: [],
  },
  {
    id: "RD04", group: "REDUNDANT", domain: "코딩",
    label: "테스트 코드 중복",
    prompt: "테스트 코드 짜주세요. 꼭 유닛테스트도 작성해주세요.",
    issues: [{
      category: "REDUNDANT", scope: "inline", occurrence: 0,
      snippet: "테스트 코드 짜주세요. 꼭 유닛테스트도 작성해주세요.",
      explanation: "'테스트 코드'와 '유닛테스트'는 같은 요구를 반복한 표현이에요.",
      replacement: "유닛테스트 코드를 작성해주세요.",
    }],
    missing_constraints: [],
  },

  // ── FILLER (3) ────────────────────────────────────────────
  {
    id: "FL01", group: "FILLER", domain: "코딩",
    label: "완곡 표현 1개",
    prompt: "아 그리고 혹시 가능하시다면 다크모드도 넣어주실 수 있을까요...",
    issues: [{
      category: "FILLER", scope: "inline", occurrence: 0,
      snippet: "아 그리고 혹시 가능하시다면 ",
      explanation: "망설임·완곡 표현은 의미를 바꾸지 않으면서 토큰만 써요.",
      replacement: "",
    }],
    missing_constraints: [],
  },
  {
    id: "FL02", group: "FILLER", domain: "데이터분석",
    label: "사과+완곡 표현",
    prompt: "음 저기 죄송한데 혹시 시간 되시면 이 데이터도 한번 봐주실 수 있으실까요.",
    issues: [{
      category: "FILLER", scope: "inline", occurrence: 0,
      snippet: "음 저기 죄송한데 혹시 시간 되시면 ",
      explanation: "사과와 완곡 표현은 요청의 의미를 바꾸지 않으면서 토큰만 써요.",
      replacement: "",
    }],
    missing_constraints: [],
  },
  {
    id: "FL03", group: "FILLER", domain: "코딩",
    label: "인접한 필러 3개 동시 발생 (인접 세그먼트 검증용)",
    prompt: "일단 그냥 대충 로그인 기능 좀 만들어봐 주실래요?",
    issues: [
      { category: "FILLER", scope: "inline", occurrence: 0, snippet: "일단 ", explanation: "군더더기 표현이에요.", replacement: "" },
      { category: "FILLER", scope: "inline", occurrence: 0, snippet: "그냥 ", explanation: "군더더기 표현이에요.", replacement: "" },
      { category: "FILLER", scope: "inline", occurrence: 0, snippet: "대충 ", explanation: "군더더기 표현이에요.", replacement: "" },
    ],
    missing_constraints: [],
  },

  // ── CLEAN (2) ─────────────────────────────────────────────
  {
    id: "CL01", group: "CLEAN", domain: "코딩",
    label: "잘 작성된 프롬프트 — 코딩",
    prompt: "Python 3.12로 리스트에서 중복을 제거하는 함수를 작성해주세요.\n함수명은 remove_duplicates, 입력은 리스트, 출력은 중복 제거된 새 리스트로 해주세요.",
    issues: [],
    missing_constraints: [],
    feedback: "잘 작성된 프롬프트예요. 언어·함수명·입출력 형식까지 명확하게 지정되어 있어요.",
  },
  {
    id: "CL02", group: "CLEAN", domain: "데이터분석",
    label: "잘 작성된 프롬프트 — 데이터분석",
    prompt: "pandas DataFrame에서 'age' 컬럼의 결측치를 평균값으로 채우는 코드를 작성해주세요.\n코드에는 한국어 주석을 달아주세요.",
    issues: [],
    missing_constraints: [],
    feedback: "필요한 조건이 모두 담겨 있어요. 이대로 보내도 좋아요.",
  },

  // ── 검증용 추가 케이스 (도메인 QA 30개 외) ──────────────────
  {
    id: "PIT01", group: "검증용", domain: "코딩",
    label: "동일 스니펫 3회 등장 — occurrence 인덱싱 검증",
    prompt: "이거 이따 확인해주시고, 이거 말고 저거 먼저 처리해주세요. 그리고 이거 최종적으로 다시 검토해주세요.",
    issues: [
      { category: "AMBIGUOUS", scope: "inline", occurrence: 0, snippet: "이거", explanation: "첫 번째 '이거'가 무엇인지 알 수 없어요.", replacement: "[확인이 필요한 대상을 구체적으로]" },
      { category: "AMBIGUOUS", scope: "inline", occurrence: 2, snippet: "이거", explanation: "세 번째 '이거'(최종 검토 대상)도 무엇인지 알 수 없어요.", replacement: "[최종 검토할 대상을 구체적으로]" },
    ],
    missing_constraints: [],
  },
];

// ── MIXED (혼합 카테고리, 5개) ────────────────────────────────
// domain_qa_list_v5.md의 30개는 "분류 정확도" 확인용이라 케이스당 카테고리가 1개뿐이었다.
// 그런데 실제 사용자 입력은 여러 이슈가 한 프롬프트 안에 섞여 나온다 — 처음 전달받은
// minifi-diagnosis-mockup.html의 포트폴리오/캘린더/챗봇 3개 데모가 정확히 그런 예시였으므로,
// 그 3개를 v5 스키마로 옮기고, CODE_DUMP·UNSTRUCTURED가 섞인 케이스를 추가로 만들었다.
let MX01, MX02, MX03, MX04, MX05;
(function () {
    const P1 = "음 저기 혹시 가능하면 ";
    const P2 = "제 포트폴리오 사이트에 ";
    const P3 = "이력서 페이지랑 프로젝트 갤러리랑 연락처 폼이랑 다크모드까지 한번에 만들어주시면 좋겠고";
    const P4 = ", ";
    const P5 = "버그 나면 버그 수정도 해주고 에러도 꼭 잡아주세요";
    const P6 = ". ";
    const P7 = "이 부분";
    const P8 = " 좀 더 ";
    const P9 = "괜찮게";
    const P10 = " 해주세요. ";
    const P11 = "아 그리고 그냥 대충 아무렇게나 부탁드려요.";
    MX01 = {
      id: "MX01", group: "MIXED", domain: "코딩",
      label: "포트폴리오 사이트 (필러·구조형·중복·모호함 혼합, 원본 목업 시나리오)",
      prompt: P1 + P2 + P3 + P4 + P5 + P6 + P7 + P8 + P9 + P10 + P11,
      issues: [
        { category: "FILLER", scope: "inline", occurrence: 0, snippet: P1,
          explanation: "망설임·완곡 표현은 의미를 바꾸지 않으면서 토큰만 써요.", replacement: "" },
        { category: "MONOLITHIC_REQUEST", scope: "structural", occurrence: 0, snippet: P3,
          explanation: "독립적으로 검증 가능한 기능이 4개예요. 아래에서 순서대로 나눌 수 있어요.", replacement: null,
          steps: [
            { title: "이력서 페이지", desc: "경력·기술 스택을 보여주는 정적 페이지" },
            { title: "프로젝트 갤러리", desc: "카드형 목록, 클릭 시 상세 모달" },
            { title: "연락처 폼", desc: "이름·이메일·메시지, 제출 시 이메일 전송" },
            { title: "다크모드 통합", desc: "위 3개 완성 후 토글 추가" },
          ] },
        { category: "REDUNDANT", scope: "inline", occurrence: 0, snippet: P5,
          explanation: "'버그 수정'과 '에러를 잡는다'는 같은 요구예요. 한 번만 쓰면 충분해요.", replacement: "에러가 발생하면 수정해주세요" },
        { category: "AMBIGUOUS", scope: "inline", occurrence: 0, snippet: P7,
          explanation: "무엇을 가리키는지 알 수 없어 LLM이 엉뚱한 곳을 고칠 수 있어요.", replacement: "연락처 폼 제출 버튼" },
        { category: "AMBIGUOUS", scope: "inline", occurrence: 0, snippet: P9,
          explanation: "'괜찮게'는 기준이 없어 결과가 매번 달라질 수 있어요.", replacement: "모바일에서도 잘 보이게(반응형으로)" },
        { category: "FILLER", scope: "inline", occurrence: 0, snippet: P11,
          explanation: "가리키는 대상이 없는 마무리 표현이라 LLM이 해석할 정보가 없어요.", replacement: "" },
      ],
      missing_constraints: [
        { field: "프론트엔드 프레임워크", confidence: "high", suggested_value: "React 18 + Vite", suggested_phrase: "React 18 + Vite 기준으로 작성해주세요." },
        { field: "색상 톤", confidence: "rec", suggested_value: "네이비·베이지 톤 유지", suggested_phrase: "네이비·베이지 톤으로 작성해주세요." },
        { field: "반응형 기준", confidence: "low", options: [
          { label: "768px 이하 1열", phrase: "768px 이하에서는 1열로 배치해주세요." },
          { label: "1024px 이하 2열", phrase: "1024px 이하에서는 2열로 배치해주세요." },
          { label: "제한 없음", phrase: null },
        ] },
      ],
    };
  })();

  (function () {
    const P1 = "일정 관리 앱에 캘린더 기능을 추가해주고 싶은데, ";
    const P2 = "음 만약 가능하다면 ";
    const P3 = "월간뷰랑 주간뷰랑 알림 설정까지 한번에 넣어주시고";
    const P4 = ", ";
    const P5 = "일정 겹치면 겹치는 것도 처리해주고 충돌 나는 것도 알아서 잘 처리해주세요";
    const P6 = ". 그리고 저기 그 ";
    const P7 = "색깔도 예쁘게";
    const P8 = " 해주세요.";
    MX02 = {
      id: "MX02", group: "MIXED", domain: "코딩",
      label: "일정관리 앱 캘린더 (필러·구조형·중복·모호함 혼합, 원본 목업 시나리오)",
      prompt: P1 + P2 + P3 + P4 + P5 + P6 + P7 + P8,
      issues: [
        { category: "FILLER", scope: "inline", occurrence: 0, snippet: P2,
          explanation: "망설임 표현이라 그대로 둬도 의미는 바뀌지 않아요.", replacement: "" },
        { category: "MONOLITHIC_REQUEST", scope: "structural", occurrence: 0, snippet: P3,
          explanation: "독립적으로 검증 가능한 기능이 3개예요. 아래에서 순서대로 나눌 수 있어요.", replacement: null,
          steps: [
            { title: "월간뷰", desc: "달력 그리드에 일정 표시" },
            { title: "주간뷰", desc: "시간대별 상세 일정 표시" },
            { title: "알림 설정", desc: "일정 시작 전 푸시/이메일 알림" },
          ] },
        { category: "REDUNDANT", scope: "inline", occurrence: 0, snippet: P5,
          explanation: "같은 요구를 두 번 반복해서 말하고 있어요.", replacement: "일정이 겹치면 충돌을 자동으로 처리해주세요" },
        { category: "AMBIGUOUS", scope: "inline", occurrence: 0, snippet: P7,
          explanation: "기준 없는 표현이라 결과가 매번 달라질 수 있어요.", replacement: "기본 테마 색상(파란 계열)으로" },
      ],
      missing_constraints: [
        { field: "반복 일정", confidence: "high", suggested_value: "매주 반복 지원", suggested_phrase: "매주 반복되는 일정도 지원해주세요." },
        { field: "알림 방식", confidence: "low", options: [
          { label: "푸시+이메일", phrase: "푸시 알림과 이메일 알림 모두 지원해주세요." },
          { label: "푸시만", phrase: "푸시 알림만 지원해주세요." },
          { label: "이메일만", phrase: "이메일 알림만 지원해주세요." },
        ] },
      ],
    };
  })();

  (function () {
    const P1 = "우리 고객센터 챗봇이 배송 문의에 답할 때 ";
    const P2 = "친절하고 친근하게, 다정하게";
    const P3 = " 답변하도록 프롬프트를 만들어줘. ";
    const P4 = "배송 조회, 반품 문의, 교환 문의 세 가지 케이스를 각각 다른 버튼으로 처리해주고";
    const P5 = ", ";
    const P6 = "애매한 질문이 오면 그냥 알아서 잘 판단해서 답변해줘";
    const P7 = ".";
    MX03 = {
      id: "MX03", group: "MIXED", domain: "코딩",
      label: "고객센터 챗봇 (중복·구조형·모호함 혼합, 원본 목업 시나리오)",
      prompt: P1 + P2 + P3 + P4 + P5 + P6 + P7,
      issues: [
        { category: "REDUNDANT", scope: "inline", occurrence: 0, snippet: P2,
          explanation: "비슷한 의미의 표현을 세 번 나열하고 있어요.", replacement: "친절한 톤으로" },
        { category: "MONOLITHIC_REQUEST", scope: "structural", occurrence: 0, snippet: P4,
          explanation: "버튼별 케이스가 3개예요. 각각 따로 정의하면 검증이 쉬워져요.", replacement: null,
          steps: [
            { title: "배송 조회", desc: "주문번호로 배송 상태 안내" },
            { title: "반품 문의", desc: "반품 사유·절차 안내" },
            { title: "교환 문의", desc: "교환 가능 조건·절차 안내" },
          ] },
        { category: "AMBIGUOUS", scope: "inline", occurrence: 0, snippet: P6,
          explanation: "판단 기준이 없어 응답이 매번 달라질 수 있어요.", replacement: "미리 정의된 FAQ에 없는 질문이면 상담사 연결을 안내해줘" },
      ],
      missing_constraints: [
        { field: "응답 언어", confidence: "high", suggested_value: "한국어", suggested_phrase: "기본 응답 언어는 한국어로 해주세요." },
      ],
    };
  })();

  (function () {
    const P1 = "음 죄송한데 이 코드가 자꾸 에러가 나서요.\n\n";
    const CODE = "def divide(a, b):\n    return a / b\n\ndivide(10, 0)\n\nZeroDivisionError: division by zero";
    const CODE_ONLY = "def divide(a, b):\n    return a / b";
    const P2 = "\n\n고쳐주실 수 있나요?";
    MX04 = {
      id: "MX04", group: "MIXED", domain: "코딩",
      label: "필러 + CODE_DUMP + MISSING_CONSTRAINT 혼합 (코드 보존 확인용)",
      prompt: P1 + CODE + P2,
      issues: [
        { category: "FILLER", scope: "inline", occurrence: 0, snippet: "음 죄송한데 ",
          explanation: "사과·완곡 표현은 의미를 바꾸지 않으면서 토큰만 써요.", replacement: "" },
        { category: "CODE_DUMP", scope: "inline", occurrence: 0, snippet: CODE,
          explanation: "코드와 에러 트레이스를 통째로 보내는 대신, 원인만 진단해서 코드 위에 붙이고 코드는 그대로 남겨드려요.",
          replacement: "[진단] b가 0일 때 ZeroDivisionError가 발생하는 나눗셈 함수\n\n" + CODE_ONLY,
          _testExpectCodeFragment: CODE_ONLY },
      ],
      missing_constraints: [
        { field: "0으로 나눌 때 처리 방식", confidence: "low", options: [
          { label: "예외 그대로 발생시키기", phrase: "0으로 나누는 경우 ZeroDivisionError를 그대로 발생시켜주세요." },
          { label: "None 반환", phrase: "0으로 나누는 경우 None을 반환하도록 처리해주세요." },
          { label: "0 반환", phrase: "0으로 나누는 경우 0을 반환하도록 처리해주세요." },
        ] },
      ],
    };
  })();

  (function () {
    const P1 = "음 혹시 가능하면 ";
    const P2 = "검색 기능 좀 만들어주세요. 키워드로 찾아지고, 최신순 정렬도 되고, 카테고리 필터도 있었으면 좋겠어요.";
    const P3 = " 백엔드는 편하신 걸로 해주세요.";
    MX05 = {
      id: "MX05", group: "MIXED", domain: "코딩",
      label: "필러 + UNSTRUCTURED + MISSING_CONSTRAINT 혼합",
      prompt: P1 + P2 + P3,
      issues: [
        { category: "FILLER", scope: "inline", occurrence: 0, snippet: P1,
          explanation: "완곡 표현이라 그대로 둬도 의미는 바뀌지 않아요.", replacement: "" },
        { category: "UNSTRUCTURED", scope: "inline", occurrence: 0, snippet: P2,
          explanation: "하나의 기능에 대한 요구사항이 흩어져 있어요. 번호 리스트로 정리해드려요.",
          replacement: "검색 기능을 다음 조건으로 만들어주세요 — 1) 키워드 검색 2) 최신순 정렬 3) 카테고리 필터" },
      ],
      missing_constraints: [
        { field: "백엔드 언어/프레임워크", confidence: "low", options: [
          { label: "Node.js + Express", phrase: "Node.js + Express로 만들어주세요." },
          { label: "Python + FastAPI", phrase: "Python + FastAPI로 만들어주세요." },
          { label: "제한 없음", phrase: null },
        ] },
      ],
    };
  })();
FIXTURES.push(MX01, MX02, MX03, MX04, MX05);

if (typeof module !== "undefined" && module.exports) {
  module.exports = { FIXTURES };
}
