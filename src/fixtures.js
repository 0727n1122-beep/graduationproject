// ============================================================
// domain_qa_list_v5.md의 30개 프롬프트를 v5 스키마(/optimize 응답 형태)로
// 재구성한 테스트 픽스처. 실제 Claude API 대신 이 데이터로 프론트 로직을 검증한다.
// snippet은 반드시 prompt의 verbatim 부분문자열이어야 하며, 이는
// test_engine.mjs가 기계적으로 검증한다(육안 확인에 의존하지 않음).
// ============================================================

const FIXTURES = [

  // ── CODE_DUMP (5) ──────────────────────────────────────────
  {
    id: "CD01", group: "CODE_DUMP", domain: "코딩",
    label: "에러 메시지 있는 코드",
    prompt: "이 코드에서 자꾸 에러가 나요 고쳐주세요.\n\n" +
      "function checkout(cart) {\n" +
      "  let total = 0;\n" +
      "  for (let i = 0; i < cart.length; i++) {\n" +
      "    total += cart[i].price;\n" +
      "  }\n" +
      "  return total.toFixed(2);\n" +
      "}\n\n" +
      "checkout(null)\n\n" +
      "TypeError: Cannot read properties of null (reading 'length')",
    issues: [{
      category: "CODE_DUMP", scope: "inline", occurrence: 0,
      snippet: "function checkout(cart) {\n" +
        "  let total = 0;\n" +
        "  for (let i = 0; i < cart.length; i++) {\n" +
        "    total += cart[i].price;\n" +
        "  }\n" +
        "  return total.toFixed(2);\n" +
        "}\n\n" +
        "checkout(null)\n\n" +
        "TypeError: Cannot read properties of null (reading 'length')",
      explanation: "코드와 에러 메시지를 통째로 보내면 토큰만 늘어요. 에러 원인과 관련 함수를 요약해서 넣어드릴게요.",
      replacement: "[코드 요약] cart의 length에 접근하기 전 null 체크가 없어 checkout(null) 호출 시 TypeError가 발생하는 checkout(cart) 합계 계산 함수",
    }],
    missing_constraints: [],
  },
  {
    id: "CD02", group: "CODE_DUMP", domain: "코딩",
    label: "에러 메시지 없는 코드 리뷰 요청",
    prompt: "이 코드 리뷰 좀 해주세요.\n\n" +
      "class UserManager:\n" +
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
      "        self.users = [u for u in self.users if u[\"email\"] != email]",
    issues: [{
      category: "CODE_DUMP", scope: "inline", occurrence: 0,
      snippet: "class UserManager:\n" +
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
        "        self.users = [u for u in self.users if u[\"email\"] != email]",
      explanation: "에러 없이 코드만 붙여넣으면, 무엇을 하는 코드인지 한 문장으로 요약해서 넣어드릴게요.",
      replacement: "[코드 요약] 사용자를 목록에 추가·이메일로 검색·삭제하는 UserManager 클래스(add_user/find_user/remove_user)",
    }],
    missing_constraints: [],
  },
  {
    id: "CD03", group: "CODE_DUMP", domain: "코딩",
    label: "대량 코드 + 특정 부분만 문제 (snippet 길이제한 예외 확인)",
    // 원문 QA 리스트엔 "90줄 컴포넌트 코드 전체 첨부"로만 서술돼 있어, 동일 취지의
    // 축약 버전(핵심 버그 재현 가능한 최소 코드)으로 구성함.
    prompt: "회원가입 폼 컴포넌트인데 제출이 안 돼요.\n\n" +
      "function SignupForm() {\n" +
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
      "}",
    issues: [{
      category: "CODE_DUMP", scope: "inline", occurrence: 0,
      snippet: "function SignupForm() {\n" +
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
        "}",
      explanation: "코드 전체를 그대로 보내면 토큰만 늘어요. 90줄이 넘어가도 snippet 길이 제한 없이 전체를 요약해드려요.",
      replacement: "[코드 요약] 이메일·비밀번호·비밀번호 확인을 입력받아 /api/signup에 회원가입 요청을 보내는 폼 컴포넌트",
    }],
    missing_constraints: [],
  },
  {
    id: "CD04", group: "CODE_DUMP", domain: "데이터분석",
    label: "pandas 전처리 코드 + 에러",
    prompt: "이 전처리 코드 실행하면 에러나요.\n\n" +
      "import pandas as pd\n" +
      "df = pd.read_csv(\"sales.csv\")\n" +
      "df['date'] = pd.to_datetime(df['date'])\n" +
      "monthly = df.groupby(df['date'].dt.month)['revenue'].sum()\n" +
      "print(monthly.plot())\n\n" +
      "KeyError: 'revenue'",
    issues: [{
      category: "CODE_DUMP", scope: "inline", occurrence: 0,
      snippet: "import pandas as pd\n" +
        "df = pd.read_csv(\"sales.csv\")\n" +
        "df['date'] = pd.to_datetime(df['date'])\n" +
        "monthly = df.groupby(df['date'].dt.month)['revenue'].sum()\n" +
        "print(monthly.plot())\n\n" +
        "KeyError: 'revenue'",
      explanation: "코드와 에러를 통째로 보내는 대신, 컬럼명 문제가 원인이라는 걸 요약해서 넣어드려요.",
      replacement: "[코드 요약] date 컬럼 기준으로 월별 revenue를 합산하려 했으나 CSV에 revenue 컬럼이 없어 KeyError가 발생하는 매출 집계 코드",
    }],
    missing_constraints: [],
  },
  {
    id: "CD05", group: "CODE_DUMP", domain: "데이터분석",
    label: "SQL 쿼리 전체, 에러 없음",
    prompt: "이 쿼리 결과가 이상하게 나와요. 확인해주세요.\n\n" +
      "SELECT customer_id, SUM(amount) as total\n" +
      "FROM orders\n" +
      "WHERE order_date >= '2026-01-01'\n" +
      "GROUP BY customer_id\n" +
      "HAVING total > 100000\n" +
      "ORDER BY total DESC",
    issues: [{
      category: "CODE_DUMP", scope: "inline", occurrence: 0,
      snippet: "SELECT customer_id, SUM(amount) as total\n" +
        "FROM orders\n" +
        "WHERE order_date >= '2026-01-01'\n" +
        "GROUP BY customer_id\n" +
        "HAVING total > 100000\n" +
        "ORDER BY total DESC",
      explanation: "에러 메시지가 없으니, 쿼리가 무엇을 하는지 요약해서 넣어드려요.",
      replacement: "[코드 요약] 2026년 이후 주문 중 고객별 합계 금액이 10만 원을 초과하는 고객을 합계 내림차순으로 조회하는 쿼리",
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = { FIXTURES };
}
