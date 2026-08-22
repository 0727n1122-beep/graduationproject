# Minifi 메타 프롬프트 v5 — UI 연동 설계

> v4.2 대비 변경: 인라인 이슈에 `replacement`/`occurrence`/`scope` 추가, MONOLITHIC_REQUEST에
> `steps[]` 추가, CODE_DUMP를 "안내문" 대신 "진단 문구 + 코드 원본 보존"으로 변경, MISSING_CONSTRAINT를
> 별도 배열(`missing_constraints`)로 분리하고 확신도 게이팅 필드를 부여.
> **UNSTRUCTURED는 애초에 structural로 분류했으나, 실구현 중 재검토해 inline으로 변경**
> (사용자 상호작용 없이 번호 리스트로 바로 치환되는 단순 텍스트 교체이기 때문 —
> MONOLITHIC_REQUEST처럼 단계를 토글로 선택하는 상호작용이 없음). structural은 이제
> MONOLITHIC_REQUEST 하나뿐.
> 이 문서는 지금까지 만든 진단 UI 목업의 실제 동작을 기준으로 역산해서 설계했습니다.

---

## 0. 왜 스키마를 바꿔야 했나

v4.2는 "무엇이 문제인지"만 답했습니다(`snippet`, `explanation`). 그런데 UI는 "적용" 버튼을 누르면
**그 자리에 뭘 넣을지**, 같은 문구가 여러 번 나오면 **어디를 바꿀지**, MONOLITHIC이면
**단계가 몇 개고 각각 뭐라고 쓸지**까지 알아야 동작합니다. v5는 그 간극을 메웁니다.

---

## 1. 실제 메타 프롬프트

```
당신은 비개발자의 프롬프트를 진단하는 Minifi의 진단 엔진입니다.
아래 [원본 프롬프트]를 분석해 JSON으로만 응답하세요. 백틱, 마크다운, 설명 문구 없이 순수 JSON만 출력합니다.

[원본 프롬프트]
{prompt}

[출력 스키마]
{
  "optimized": "전체 재작성본 (전체 적용 시 사용)",
  "issues": [ ... 아래 2장 참고 ... ],
  "missing_constraints": [ ... 아래 5장 참고 ... ],
  "feedback": "issues와 missing_constraints가 모두 비었을 때만 채움. 예: '잘 작성된 프롬프트예요'"
}

[카테고리 7종]
- AMBIGUOUS: 모호한 지시어 ("이거", "그거", "어떻게든")
- FILLER: 의미 없는 군더더기 ("아 그리고", "혹시", 사과·망설임 표현)
- REDUNDANT: 같은 요구의 중복 표현
- CODE_DUMP: 코드를 통째로 붙여넣음
- UNSTRUCTURED: 요구사항이 번호나 구조 없이 흩어져 있음
- MONOLITHIC_REQUEST: 독립적으로 검증 가능한 기능을 3개 이상 한 번에 요청
- MISSING_CONSTRAINT: 출력 형식·언어·프레임워크 등 조건 누락

[절대 규칙]
1. snippet은 원본의 문자 단위 verbatim 부분문자열만 사용한다. 패러프레이즈 금지, 지어내기 금지.
2. 확정되지 않은 값을 임의로 채우지 않는다. 사용자가 명시하지 않은 프레임워크·라이브러리 등을
   추측해서 넣지 않는다 — MISSING_CONSTRAINT의 confidence 규칙(5장)을 따른다.
3. issues와 missing_constraints가 비어 있으면 문제를 조작해서 만들어내지 않는다.
4. replacement, suggested_phrase는 전부 "사용자가 LLM에게 보내는 요청" 어투로 쓴다.
   ("~해주세요" 류) LLM이 사용자에게 답하는 어투(질문형, 응답형)를 쓰지 않는다.
   — 단, CODE_DUMP의 replacement는 예외로 4장 규칙을 따른다(코드는 보존하고 진단 문구만 설명형으로).
5. 멱등성: 이미 정리된 프롬프트를 다시 진단할 때 없던 이슈를 지어내지 않는다.
   변화가 없다면 issues=[], missing_constraints=[]로 답하고 feedback을 채운다.
```

> **`optimized` vs `optimized_prompt` — 레이어가 다르다.** 위 스키마의 `optimized`는 Claude에게 그대로
> 시키는 키다. `/optimize` API가 프론트로 내려주는 최종 응답에서는 백엔드가 `result["optimized"]`를
> 받아 `optimized_prompt`라는 이름으로 바꿔서 내보낸다. 즉 **Claude 쪽 스키마 키는 `optimized`**,
> **프론트가 실제로 받는 API 응답 키는 `optimized_prompt`** — 둘 다 맞는 값이고, 문서마다 어느 레이어를
> 가리키는지만 명확히 하면 된다.

---

## 2. issues 공통 필드

```json
{
  "id": "i1",
  "category": "AMBIGUOUS | FILLER | REDUNDANT | CODE_DUMP | UNSTRUCTURED | MONOLITHIC_REQUEST",
  "scope": "inline | structural",
  "snippet": "원본의 verbatim 부분문자열 (CODE_DUMP·UNSTRUCTURED 제외, 그 외 카테고리는 핵심 표현만 30자 미만 엄수 — 초과 시 앞부분만 verbatim으로 잘라서 사용)",
  "occurrence": 0,
  "explanation": "왜 문제인지, 한 문장"
}
```

| 필드 | 설명 |
|---|---|
| `id` | 이슈 고유 id. 백엔드가 검증 단계(6장)에서 일부 이슈를 드롭할 수 있어 배열 인덱스로 참조하면 안 됨 |
| `scope` | `inline`(그 자리에서 편집) vs `structural`(별도 패널, 8장) — 프론트 라우팅 기준 |
| `occurrence` | 동일 snippet이 여러 번 나올 때 몇 번째(0-based)인지 |
| `snippet` 길이 | CODE_DUMP·UNSTRUCTURED만 길이 제한 없음. 그 외(AMBIGUOUS·FILLER·REDUNDANT·MONOLITHIC_REQUEST)는 30자 미만 엄수, 초과 시 앞부분만 verbatim으로 잘라서 사용 |

> 검증을 통과한 snippet은 길이에 상관없이 항상 원본의 순수 verbatim 부분문자열이다(말줄임표 등
> 원문에 없는 문자가 붙는 경우는 없음). 30자를 넘는 경우도 앞부분을 그대로 잘라 쓸 뿐이라 프론트의
> `indexOf` 기반 매칭이 별도 처리 없이 그대로 통한다.

`scope: inline`인 카테고리(AMBIGUOUS·FILLER·REDUNDANT·CODE_DUMP·UNSTRUCTURED)만 `replacement`를 가진다.
`scope: structural`인 카테고리(MONOLITHIC_REQUEST 하나뿐)는 `steps`를 가진다(8장).

---

## 3. 인라인 이슈 (FILLER · REDUNDANT · AMBIGUOUS · CODE_DUMP · UNSTRUCTURED)

```json
{
  "id": "i1",
  "category": "FILLER",
  "scope": "inline",
  "snippet": "아 진짜 죄송한데 혹시 시간 되시면,",
  "occurrence": 0,
  "explanation": "사과와 망설임 표현은 의미를 바꾸지 않으면서 토큰만 써요.",
  "replacement": ""
}
```

카테고리별 `replacement` 생성 규칙:

| 카테고리 | replacement 규칙 |
|---|---|
| `FILLER` | 항상 빈 문자열 `""` (삭제) |
| `REDUNDANT` | 중복을 제거한 고정 문장 1개 |
| `AMBIGUOUS` | **기본값**만 채운다. 사용자가 UI에서 직접 고칠 수 있다는 걸 전제로, 가장 가능성 높은 지시 대상으로 추론 |
| `CODE_DUMP` | 4장 규칙에 따라 코드는 보존하고 진단 문구만 앞에 붙임 (요청 어투 아님) |
| `UNSTRUCTURED` | snippet(흩어진 요구 전체)을 번호 리스트로 재구성한 문장 1개. 사용자 선택 없이 그 자리에서 바로 치환됨(MONOLITHIC_REQUEST처럼 단계를 나눠 순차 진행시키는 게 아니라 정리만 함) |

---

## 4. CODE_DUMP — 코드는 그대로 두고 진단만 덧붙일 것

v4.2까지는 "에러 난 부분만 보내세요" 같은 **사용자에게 시키는 안내문**이었습니다.
v5 초안은 AI가 **그 코드를 요약문으로 통째로 대체**했지만, 이건 실사용에서 문제가 있었습니다 —
"이 코드 고쳐주세요" 류 요청은 다음 단계에서 실제로 코드를 수정해야 하는데, 원본 코드가
요약으로 대체되어 사라지면 그 수정 자체가 불가능해집니다. **v5는 코드 원본을 절대 삭제하지 않고,
진단 문구만 코드 위에 덧붙입니다.** 코드 자체는 토큰 절감 대상이 아니고, 코드를 둘러싼 장황한
자연어 설명·에러 트레이스만 축약 대상입니다(MONOLITHIC_REQUEST처럼 토큰이 늘어날 수 있는
"재프롬프팅 감소형" 최적화에 가깝습니다).

```
[CODE_DUMP replacement 생성 규칙]
- 코드 본문은 절대 삭제·요약·축약하지 않는다. verbatim 그대로 replacement 안에 포함시킨다.
  (다음 턴에서 실제로 코드를 고치려면 원본이 반드시 남아 있어야 하기 때문)
- 축약 대상은 코드가 아니라 "코드를 둘러싼 장황한 텍스트"다 — 에러 스택 트레이스 원문,
  중복된 호출부(예: 재현용으로 붙인 `checkout(null)` 같은 호출 라인) 등.
- 코드 블록에 에러 메시지가 함께 있으면: 에러 원인 + 관련 함수를 한 줄로 진단하고,
  "[진단] {한 줄 진단}" 뒤에 빈 줄을 두고 원본 코드를 그대로 이어붙인다.
- 에러 메시지가 없으면: 코드가 무엇을 하는지 한 줄로 설명하고,
  "[코드 설명] {한 줄 설명}" 뒤에 빈 줄을 두고 원본 코드를 그대로 이어붙인다.
- 진단/설명 문구의 어투는 설명형 명사구. "~해주세요" 요청 어투를 쓰지 않는다 (1장 규칙 4의 예외)
- 형식: "[진단] {한 줄 진단}\n\n{원본 코드 verbatim}" (에러 없으면 "[코드 설명]" 사용)
- 코드 안에 명백히 무관한 부분(질문과 상관없는 다른 함수·미사용 import 등)이 섞여 있어도,
  제외 여부가 불확실하면 전부 유지한다 — 정보 손실이 토큰 절감보다 항상 우선한다.
```

예시:
```json
{
  "category": "CODE_DUMP",
  "snippet": "def checkout(cart):\n    total = 0\n    for i in cart:\n        total += i.price\n    return total\n\ncheckout(None)\n\nTypeError: unsupported operand type(s) for +=: 'int' and 'NoneType'",
  "occurrence": 0,
  "explanation": "코드와 에러 트레이스를 통째로 보내면 토큰만 늘어요. 원인만 진단해서 코드 위에 붙이고, 코드 자체는 그대로 남겨드릴게요.",
  "replacement": "[진단] cart가 None일 때 반복문에서 바로 오류가 나는 것으로 보이는 checkout(cart) 함수\n\ndef checkout(cart):\n    total = 0\n    for i in cart:\n        total += i.price\n    return total"
}
```

> 위 예시에서 `checkout(None)` 호출 라인과 원본 `TypeError` 트레이스는 진단 문구로 흡수되어
> 빠졌지만, **함수 본문(`def checkout...` ~ `return total`)은 한 글자도 바뀌지 않고 그대로
> 남아 있습니다.** 이게 v5 CODE_DUMP의 핵심 변경점입니다.

---

## 5. missing_constraints — MISSING_CONSTRAINT 전용 배열

`issues`가 아니라 **별도 배열**입니다. 하이라이트할 원본 텍스트가 없는(=없는 것을 채우는) 항목이라
snippet/occurrence 개념 자체가 적용되지 않기 때문입니다.

```json
{
  "field": "언어",
  "confidence": "high | rec | low",
  "suggested_value": "Python",
  "suggested_phrase": "Python으로 작성해주세요.",
  "options": null
}
```

| confidence | 의미 | UI 동작 | suggested_value/phrase | options |
|---|---|---|---|---|
| `high` | 원문에서 확실히 감지됨(예: 붙여넣은 코드가 Python) | 기본 켜짐, 미리 채움 | 필수 | 없음 |
| `rec` | 단서는 없지만 합리적인 기본값 | 기본 켜짐, 미리 채움 | 필수 | 없음 |
| `low` | 단서도 없고 순수 취향/선택 | 기본 꺼짐, 값 비움, 선택지만 | `null` | 2~4개 |

`low`일 때 `options`:
```json
"options": [
  { "label": "768px 이하 1열", "phrase": "768px 이하에서는 1열로 배치해주세요." },
  { "label": "1024px 이하 2열", "phrase": "1024px 이하에서는 2열로 배치해주세요." },
  { "label": "제한 없음", "phrase": null }
]
```

**절대 규칙(1장 규칙 2와 동일):** `low`인 항목에 `suggested_value`를 임의로 채우지 않는다.
단서 없는 프레임워크·라이브러리를 확정값처럼 제시하는 것은 "없는 조건 조작"에 해당한다.

---

## 6. 백엔드 검증 (Claude가 아니라 백엔드가 하는 일)

메타 프롬프트 지시는 아니지만, 프론트가 정확히 동작하려면 백엔드가 응답을 그대로 통과시키면 안 됩니다.

1. **snippet 존재 검증**: `issues[].snippet`이 원본 프롬프트에 실제로 존재하는지 확인. 없으면 그 이슈를 드롭.
2. **occurrence 범위 검증**: snippet이 원본에 등장하는 횟수보다 `occurrence`가 크면 드롭(또는 0으로 보정).
3. **최소 검증만** — snippet 위치를 백엔드가 offset으로 미리 계산해서 내려줄 필요는 없다.
   위치 계산(`indexOf` 기반)은 프론트 책임(7장).

---

## 7. 프론트가 하는 일 (요약 — 상세는 별도 연동 가이드 참고)

- `snippet` + `occurrence`로 원본에서 정확한 위치를 찾아 하이라이트 span을 만든다.
- `scope:"inline"` → 밑줄 + hover 팝오버(적용/건너뛰기). AMBIGUOUS만 `replacement`를 편집 가능한
  입력창 기본값으로 사용.
- `scope:"structural"` → 별도 패널로 라우팅(8장).
- `missing_constraints` → 확신도 게이팅 체크리스트로 렌더(5장 표 그대로).

---

## 8. MONOLITHIC_REQUEST — steps 배열 (v5에서 새로 생김)

v4.1까지는 "3개 이상이면 발동" 규칙만 있었고, **정작 몇 단계로 나눌지는 없었습니다.**
v5는 실제 단계 제목·설명을 생성합니다.

```json
{
  "id": "i2",
  "category": "MONOLITHIC_REQUEST",
  "scope": "structural",
  "snippet": "로그인이랑 상품목록이랑 장바구니랑 결제까지 전부",
  "occurrence": 0,
  "explanation": "독립적으로 검증 가능한 기능이 4개예요. 아래에서 순서대로 나눌 수 있어요.",
  "steps": [
    { "title": "로그인 · 회원 인증", "desc": "이메일·비밀번호 기반 회원가입·로그인, 세션 발급" },
    { "title": "상품 목록 조회", "desc": "이름·가격·이미지 필드, 페이지 단위 조회" },
    { "title": "장바구니 담기 · 관리", "desc": "담기·수량 변경·삭제, 사용자별 유지" },
    { "title": "결제 및 통합", "desc": "결제 처리, 1~3단계 통합, 예외 처리 포함" }
  ]
}
```

| 필드 | 어디 쓰이나 |
|---|---|
| `title` | 짧은 이름. 사용자가 "적용" 시 **최종 프롬프트 문구를 조립하는 재료**로 쓰임(프론트가 조립, 9장 참고) |
| `desc` | 1문장 설명. 적용 **전** 계획 미리보기에만 쓰이고, 적용된 프롬프트 문구에는 안 들어감 |

**트리거 규칙(v4.1 유지):** 독립적으로 기능하고 검증 가능한 항목이 3개 이상일 때만 발동.
다크모드 토글처럼 단일 기능을 과분할하지 않는다.

`steps`는 MONOLITHIC_REQUEST 전용이다. UNSTRUCTURED는 3장 규칙대로 번호 리스트 텍스트로
직접 치환되며(inline) 별도 패널이나 `steps` 구조를 쓰지 않는다.

---

## 9. 프론트 조립 로직 (참고용 — 백엔드는 이 로직을 몰라도 됨)

MONOLITHIC 최종 문구는 **Claude가 만들지 않고 프론트가 실시간으로 조립**합니다. 사용자가 단계를
켜고 끄면 그 즉시 문구가 바뀌어야 해서(재호출 없이) 프론트에서 처리하는 게 맞습니다.

```
켜진 단계만 모아서:
"다음 순서로 단계별로 진행해주세요 — 1) {title} 2) {title} ..."
```

즉 메타 프롬프트는 `steps[].title`만 좋은 재료로 만들어주면 되고, 문장 조립·번호 재부여는
전부 프론트 몫입니다.

---

## 10. 전체 응답 예시 (포트폴리오 시나리오 기준)

```json
{
  "optimized": "...",
  "issues": [
    {
      "id": "i1", "category": "FILLER", "scope": "inline",
      "snippet": "음 저기 혹시 가능하면 ", "occurrence": 0,
      "explanation": "의미를 바꾸지 않으면서 토큰만 쓰는 표현이에요.",
      "replacement": ""
    },
    {
      "id": "i2", "category": "AMBIGUOUS", "scope": "inline",
      "snippet": "이거", "occurrence": 0,
      "explanation": "무엇을 가리키는지 LLM이 알 수 없어 엉뚱한 부분을 고쳐요.",
      "replacement": "장바구니 담기 버튼"
    },
    {
      "id": "i3", "category": "MONOLITHIC_REQUEST", "scope": "structural",
      "snippet": "이력서 페이지랑 프로젝트 갤러리랑 연락처 폼이랑",
      "occurrence": 0,
      "explanation": "독립적으로 검증 가능한 기능이 4개예요.",
      "steps": [
        { "title": "이력서 페이지", "desc": "경력·기술 스택을 보여주는 정적 페이지" },
        { "title": "프로젝트 갤러리", "desc": "카드형 목록, 클릭 시 상세 모달" },
        { "title": "연락처 폼", "desc": "이름·이메일·메시지, 제출 시 이메일 전송" },
        { "title": "다크모드 통합", "desc": "위 3개 완성 후 토글 추가" }
      ]
    }
  ],
  "missing_constraints": [
    {
      "field": "프론트엔드 프레임워크", "confidence": "high",
      "suggested_value": "React 18 + Vite", "suggested_phrase": "React 18 + Vite 기준으로 작성해주세요.",
      "options": null
    },
    {
      "field": "반응형 기준", "confidence": "low",
      "suggested_value": null, "suggested_phrase": null,
      "options": [
        { "label": "768px 이하 1열", "phrase": "768px 이하에서는 1열로 배치해주세요." },
        { "label": "1024px 이하 2열", "phrase": "1024px 이하에서는 2열로 배치해주세요." },
        { "label": "제한 없음", "phrase": null }
      ]
    }
  ],
  "feedback": ""
}
```

---

## 11. v4.2 → v5 변경 요약

| 항목 | v4.2 | v5 |
|---|---|---|
| 인라인 적용 텍스트 | 없음(프론트가 추측 불가) | `replacement` 추가 |
| 중복 snippet 위치 | 없음(첫 매칭만 가능) | `occurrence` 추가 |
| 인라인/구조 라우팅 | 카테고리명으로 프론트가 하드코딩 | `scope` 필드로 명시 (structural은 MONOLITHIC_REQUEST뿐) |
| MONOLITHIC 단계 내용 | 없음(발동 여부만) | `steps[]` 추가 |
| CODE_DUMP 대응 | 안내 문구(사용자에게 시킴) | 코드 보존 + 진단 문구(4장 규칙) |
| MISSING_CONSTRAINT | 없음 | `missing_constraints[]` 신설, confidence 게이팅 |
| 비용 | — | 전부 기존 `/optimize` 1회 호출에 포함, 추가 호출 없음 |

---

## 12. 미결 사항

- ~~**UNSTRUCTURED 전용 UI**~~ — **해결됨.** 실구현 검토 중 UNSTRUCTURED를 inline으로
  재분류(3장)해서 별도 UI 자체가 불필요해짐. 기존 팝오버(적용/건너뛰기)를 그대로 재사용.
- **guide 필드(v4.2)**: 현재 인라인 팝오버는 `explanation`만 보여주고 `guide.tip/example_bad/example_good`은
  화면에 안 씁니다. 학습 카드 등 별도 화면이 생기기 전까지는 응답에서 빼도 무방(토큰 절감).
- **id 안정성**: 지금 목업은 배열 index로 이슈를 참조하지만(예: `apply(i)`), 실제 구현에서는
  6장의 백엔드 검증(드롭)이 있으면 index가 밀립니다. 프론트도 `id` 기준 참조로 바꾸는 걸 권장.
