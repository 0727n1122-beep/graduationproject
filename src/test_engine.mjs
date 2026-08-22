import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require("./engine.js");
const { FIXTURES } = require("./fixtures.js");

let pass = 0, fail = 0;
const failures = [];

function check(label, fn) {
  try {
    fn();
    pass++;
  } catch (e) {
    fail++;
    failures.push({ label, error: e.message });
    console.log("  ✗ " + label + "  →  " + e.message);
  }
}

console.log("=== 1. 픽스처별 기본 무결성 (id 중복, snippet 실존, occurrence 범위) ===");
for (const fx of FIXTURES) {
  check(`[${fx.id}] issues 정규화 후 id가 전부 고유함`, () => {
    const norm = E.normalizeIssues(fx.issues);
    const ids = norm.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, "중복 id 발견: " + ids.join(","));
  });

  check(`[${fx.id}] 모든 issue의 snippet이 prompt에서 실제로 발견됨 (occurrence 포함)`, () => {
    const norm = E.normalizeIssues(fx.issues);
    const { ordered, dropped } = E.resolvePositions(fx.prompt, norm);
    assert.equal(dropped.length, 0,
      "다음 이슈가 원본에서 발견되지 않음: " + dropped.map((d) => `${d.category}:"${d.snippet}"@${d.occurrence}`).join(" / "));
    assert.equal(ordered.length, norm.length, "겹치는 범위로 드롭된 이슈가 있음(overlap)");
  });

  check(`[${fx.id}] 세그먼트를 원문으로 되돌리면 100% 일치 (round-trip)`, () => {
    const norm = E.normalizeIssues(fx.issues);
    const { ordered } = E.resolvePositions(fx.prompt, norm);
    const segs = E.buildDisplaySegments(fx.prompt, ordered);
    assert.equal(E.segmentsToRawText(segs), fx.prompt);
  });
}

console.log("\n=== 2. scope 라우팅 — structural은 MONOLITHIC_REQUEST 하나뿐 ===");
for (const fx of FIXTURES) {
  for (const issue of fx.issues) {
    check(`[${fx.id}] category=${issue.category} → scope=${issue.scope} 규칙 확인`, () => {
      if (issue.category === "MONOLITHIC_REQUEST") {
        assert.equal(issue.scope, "structural", "MONOLITHIC_REQUEST는 반드시 structural이어야 함");
      } else {
        assert.equal(issue.scope, "inline",
          `${issue.category}는 반드시 inline이어야 함 (오늘 재분류된 CODE_DUMP/UNSTRUCTURED 포함)`);
      }
      assert.equal(E.isStructural(issue), issue.scope === "structural");
    });
  }
}

console.log("\n=== 3. MONOLITHIC_REQUEST steps 유효성 (3~6개, title 필수) ===");
for (const fx of FIXTURES) {
  for (const issue of fx.issues) {
    if (issue.category !== "MONOLITHIC_REQUEST") continue;
    check(`[${fx.id}] steps 3~6개 + title 전부 존재 + replacement=null`, () => {
      assert.ok(Array.isArray(issue.steps), "steps가 배열이 아님");
      assert.ok(issue.steps.length >= 3 && issue.steps.length <= 6, `steps 개수=${issue.steps.length}`);
      for (const s of issue.steps) assert.ok(s.title, "title 누락된 step 있음");
      assert.equal(issue.replacement, null, "structural인데 replacement가 null이 아님");
    });
  }
}

console.log("\n=== 4. CODE_DUMP / UNSTRUCTURED replacement 톤 규칙 ===");
for (const fx of FIXTURES) {
  for (const issue of fx.issues) {
    if (issue.category === "CODE_DUMP") {
      check(`[${fx.id}] CODE_DUMP replacement는 "[진단]" 또는 "[코드 설명]"으로 시작`, () => {
        assert.ok(issue.replacement && /^\[(진단|코드 설명)\]/.test(issue.replacement));
      });
      check(`[${fx.id}] CODE_DUMP replacement가 원본 코드를 삭제하지 않고 보존함`, () => {
        assert.ok(issue._testExpectCodeFragment, "테스트 메타데이터(_testExpectCodeFragment) 누락");
        assert.ok(issue.replacement.includes(issue._testExpectCodeFragment),
          "replacement에 원본 코드 조각이 verbatim으로 남아있지 않음 — 코드가 삭제/변형됨");
      });
    }
    if (issue.category === "FILLER") {
      check(`[${fx.id}] FILLER replacement는 항상 빈 문자열`, () => {
        assert.equal(issue.replacement, "");
        assert.equal(E.isDeleteIssue(issue), true);
      });
    }
    if (issue.category === "AMBIGUOUS") {
      check(`[${fx.id}] AMBIGUOUS만 편집 가능 판정`, () => {
        assert.equal(E.isEditable(issue), true);
      });
    } else {
      check(`[${fx.id}] ${issue.category}는 편집 불가 판정 (AMBIGUOUS 아님)`, () => {
        assert.equal(E.isEditable(issue), false);
      });
    }
  }
}

console.log("\n=== 5. missing_constraints confidence 게이팅 ===");
for (const fx of FIXTURES) {
  check(`[${fx.id}] missing_constraints 정규화 규칙 (low는 value/phrase null, options 2~4개)`, () => {
    const norm = E.normalizeMissingConstraints(fx.missing_constraints);
    const ids = norm.map((m) => m._id);
    assert.equal(new Set(ids).size, ids.length, "합성 id 중복 발생");
    for (const m of norm) {
      assert.ok(["high", "rec", "low"].includes(m.confidence));
      if (m.confidence === "low") {
        assert.equal(m.suggested_value, null);
        assert.equal(m.suggested_phrase, null);
        assert.ok(m.options.length >= 2 && m.options.length <= 4, `low인데 options 개수=${m.options.length}`);
        assert.equal(m.on, false, "low는 초기 상태가 꺼져 있어야 함");
        assert.equal(m.phrase, null);
      } else {
        assert.ok(m.suggested_value, "high/rec인데 suggested_value 없음");
        assert.ok(m.suggested_phrase, "high/rec인데 suggested_phrase 없음");
        assert.equal(m.on, true, "high/rec는 초기 상태가 켜져 있어야 함");
        assert.equal(m.phrase, m.suggested_phrase, "phrase는 suggested_phrase로 초기화되어야 함");
      }
    }
  });
}

console.log("\n=== 6. 카테고리별 밑줄 스타일 그룹 (연동 가이드 2장) ===");
const STYLE_EXPECT = {
  FILLER: "faint", REDUNDANT: "faint",
  AMBIGUOUS: "strong", CODE_DUMP: "strong", UNSTRUCTURED: "strong",
  MONOLITHIC_REQUEST: "mono",
};
for (const [cat, expected] of Object.entries(STYLE_EXPECT)) {
  check(`styleGroupFor(${cat}) === ${expected}`, () => {
    assert.equal(E.styleGroupFor(cat), expected);
  });
}

console.log("\n=== 7. occurrence 0-based / 다중 매칭 정밀 검증 (PIT01) ===");
check("PIT01: '이거'가 3번 등장, occurrence=0은 첫 번째, occurrence=2는 세 번째를 가리킴", () => {
  const fx = FIXTURES.find((f) => f.id === "PIT01");
  const norm = E.normalizeIssues(fx.issues);
  const { ordered, dropped } = E.resolvePositions(fx.prompt, norm);
  assert.equal(dropped.length, 0);
  const firstStart = fx.prompt.indexOf("이거");
  const secondStart = fx.prompt.indexOf("이거", firstStart + 1);
  const thirdStart = fx.prompt.indexOf("이거", secondStart + 1);
  const occ0 = ordered.find((i) => i.occurrence === 0);
  const occ2 = ordered.find((i) => i.occurrence === 2);
  assert.equal(occ0.start, firstStart, "occurrence=0이 첫 번째 등장 위치와 다름");
  assert.equal(occ2.start, thirdStart, "occurrence=2가 세 번째 등장 위치와 다름");
  assert.notEqual(occ0.start, occ2.start);
});

check("occurrence가 1-based로 잘못 해석되면(버그 재현) 실패해야 정상 — 회귀 방지용", () => {
  // occurrence를 1-based로 잘못 계산하는 예전 버그를 재현해서, 새 로직이 그 버그와
  // 다른(=올바른) 결과를 내는지 확인한다.
  const buggyLocate = (text, snippet, occurrence1Based) => {
    let idx = -1, from = 0;
    for (let c = 1; c <= occurrence1Based; c++) { idx = text.indexOf(snippet, from); from = idx + 1; }
    return idx;
  };
  const text = "이거 이따 확인해주시고, 이거 말고 저거 먼저 처리해주세요. 그리고 이거 최종적으로 다시 검토해주세요.";
  const correct = E.locateSnippet(text, "이거", 0); // 올바른 0-based: 첫 번째
  const buggy = buggyLocate(text, "이거", 0); // 1-based로 잘못 해석 시 occurrence=0 → indexOf 0번 반복 → -1(못 찾음)
  assert.equal(buggy, -1, "버그 시뮬레이션 자체가 잘못 짜임");
  assert.equal(correct.start, text.indexOf("이거"));
});

console.log("\n=== 8. 인접 세그먼트(FL03) — 텍스트 간격 0인 이슈 3개 연속 처리 ===");
check("FL03: 일단/그냥/대충 3개가 서로 인접해도 세그먼트가 정상 구성됨", () => {
  const fx = FIXTURES.find((f) => f.id === "FL03");
  const norm = E.normalizeIssues(fx.issues);
  const { ordered, dropped, overlapDropped } = E.resolvePositions(fx.prompt, norm);
  assert.equal(dropped.length, 0);
  assert.equal(overlapDropped.length, 0);
  const segs = E.buildDisplaySegments(fx.prompt, ordered);
  assert.equal(E.segmentsToRawText(segs), fx.prompt);
  const issueSegs = segs.filter((s) => s.type === "issue");
  assert.equal(issueSegs.length, 3);
  // 적용 후: 세 필러를 모두 삭제하면 "로그인 기능 좀 만들어봐 주실래요?"만 남아야 함
  for (const s of issueSegs) s.issue.status = "applied";
  const finalText = E.assembleFinalText(fx.prompt, segs, []);
  assert.equal(finalText, "로그인 기능 좀 만들어봐 주실래요?");
});

console.log("\n=== 9. 여러 이슈 동시 적용 — 세그먼트 방식 vs 뒤→앞 splice 방식 교차검증 ===");
for (const fx of FIXTURES) {
  if (fx.issues.length < 2) continue;
  check(`[${fx.id}] 전체 적용 시 두 구현 방식(세그먼트 / 뒤→앞 splice)의 결과가 동일함`, () => {
    const norm = E.normalizeIssues(fx.issues);
    const { ordered } = E.resolvePositions(fx.prompt, norm);
    const withState = ordered.map((i) => Object.assign({}, i, {
      status: "applied",
      _monoSteps: i.category === "MONOLITHIC_REQUEST" ? i.steps.map((s) => ({ title: s.title, on: true })) : undefined,
    }));
    const segs = E.buildDisplaySegments(fx.prompt, withState);
    const viaSegments = E.assembleFinalText(fx.prompt, segs, []);
    const viaBackToFront = E.spliceReplacementsBackToFront(fx.prompt, withState);
    assert.equal(viaSegments, viaBackToFront);
  });
}

console.log("\n=== 10. 방어 로직 — 비정상 응답 시뮬레이션 ===");
check("snippet이 원본에 없는 이슈는 drop됨 (백엔드 검증과 동일)", () => {
  const prompt = "테스트 프롬프트입니다.";
  const issues = E.normalizeIssues([
    { category: "AMBIGUOUS", scope: "inline", occurrence: 0, snippet: "존재하지않는텍스트", replacement: "x" },
  ]);
  const { ordered, dropped } = E.resolvePositions(prompt, issues);
  assert.equal(ordered.length, 0);
  assert.equal(dropped.length, 1);
});

check("occurrence가 실제 등장 횟수를 초과하면 drop됨", () => {
  const prompt = "이거 그리고 이거.";
  const issues = E.normalizeIssues([
    { category: "AMBIGUOUS", scope: "inline", occurrence: 5, snippet: "이거", replacement: "x" },
  ]);
  const { dropped } = E.resolvePositions(prompt, issues);
  assert.equal(dropped.length, 1);
});

check("id가 중복/누락된 issues는 백엔드 규칙(i{n})처럼 재부여됨", () => {
  const norm = E.normalizeIssues([
    { id: "i1", category: "FILLER", scope: "inline", occurrence: 0, snippet: "a", replacement: "" },
    { id: "i1", category: "FILLER", scope: "inline", occurrence: 0, snippet: "b", replacement: "" }, // 중복 id
    { category: "FILLER", scope: "inline", occurrence: 0, snippet: "c", replacement: "" }, // id 없음
  ]);
  const ids = norm.map((i) => i.id);
  assert.equal(new Set(ids).size, 3, "중복/누락 id가 재부여되지 않음: " + ids.join(","));
});

check("겹치는 범위(overlap)를 주면 뒤에 오는 쪽이 안전하게 drop됨(크래시 없이)", () => {
  const prompt = "회원가입 폼을 만들어주세요.";
  const issues = E.normalizeIssues([
    { category: "UNSTRUCTURED", scope: "inline", occurrence: 0, snippet: "회원가입 폼을 만들어주세요.", replacement: "x" },
    { category: "AMBIGUOUS", scope: "inline", occurrence: 0, snippet: "폼을", replacement: "y" }, // 위 스니펫과 겹침
  ]);
  const { ordered, overlapDropped } = E.resolvePositions(prompt, issues);
  assert.equal(ordered.length, 1);
  assert.equal(overlapDropped.length, 1);
});

check("confidence 값이 이상하면(backend 방어 규칙과 동일) low로 강제되고 값이 null 처리됨", () => {
  const norm = E.normalizeMissingConstraints([
    { field: "이상한 필드", confidence: "medium", suggested_value: "몰래채움", suggested_phrase: "몰래 채운 문장" },
  ]);
  assert.equal(norm[0].confidence, "low");
  assert.equal(norm[0].suggested_value, null);
  assert.equal(norm[0].suggested_phrase, null);
});

check("id에 따옴표가 섞여 있으면(마크업 깨짐 방지) 안전하지 않은 것으로 판정하고 재부여됨", () => {
  const norm = E.normalizeIssues([
    { id: "danger'\"<script>", category: "FILLER", scope: "inline", occurrence: 0, snippet: "a", replacement: "" },
  ]);
  assert.equal(E.isSafeId(norm[0].id), true);
  assert.notEqual(norm[0].id, "danger'\"<script>");
});

console.log("\n=== 11. id 기준 참조 — 배열 index가 아니라 id로 상태를 찾을 수 있는지 ===");
check("드롭된 이슈가 있어도 남은 이슈를 id로 정확히 찾을 수 있음 (index 참조였다면 밀렸을 상황)", () => {
  const prompt = "이거 그리고 저거를 고쳐주세요.";
  const raw = [
    { id: "keep-me-1", category: "AMBIGUOUS", scope: "inline", occurrence: 0, snippet: "존재안함", replacement: "x" }, // drop됨
    { id: "keep-me-2", category: "AMBIGUOUS", scope: "inline", occurrence: 0, snippet: "저거", replacement: "y" },
  ];
  const norm = E.normalizeIssues(raw);
  const { ordered, dropped } = E.resolvePositions(prompt, norm);
  assert.equal(dropped.length, 1);
  assert.equal(ordered.length, 1);
  // 배열 index로 찾으면(ordered[0]이 원래 raw[0]이라고 착각) 완전히 틀린 이슈를 잡게 됨.
  // id 기준으로 찾아야 살아남은 issue를 정확히 잡는다.
  const byId = new Map(ordered.map((i) => [i.id, i]));
  assert.ok(byId.has("keep-me-2"));
  assert.ok(!byId.has("keep-me-1"));
});

console.log("\n=== 12. MIXED 픽스처 — 실제로 서로 다른 카테고리가 섞여 있는지 ===");
for (const fx of FIXTURES) {
  if (fx.group !== "MIXED") continue;
  check(`[${fx.id}] issue 카테고리가 2종 이상 혼합됨`, () => {
    const cats = new Set(fx.issues.map((i) => i.category));
    assert.ok(cats.size >= 2, `카테고리가 ${cats.size}종뿐임: ${[...cats].join(",")}`);
  });
}

console.log("\n" + "=".repeat(60));
console.log(`결과: ${pass}개 통과, ${fail}개 실패`);
if (fail > 0) {
  console.log("\n실패 목록:");
  failures.forEach((f) => console.log(" - " + f.label + " :: " + f.error));
  process.exit(1);
} else {
  console.log("모든 검증 통과.");
}
