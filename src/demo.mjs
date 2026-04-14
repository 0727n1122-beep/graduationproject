import http from "node:http";

const PORT = 3000;

const HARDCODED = {
  optimized: `BeautifulSoup + requests를 사용하여 네이버 뉴스 크롤러를 작성해주세요.

[요구사항]
1. 뉴스 제목과 링크 추출
2. try-except로 HTTP 에러 처리
3. 결과를 CSV 파일로 저장
4. logging 모듈로 로그 기록
5. 재사용 가능한 클래스 구조

[출력 조건]
- 한국어 주석 포함
- pip install 명령어 및 실행 방법 안내
- Selenium은 불필요 시 제외`,
  issues: [
    "\"그냥 다 알려줘\" — 범위가 불명확하여 불필요한 출력이 대량 발생",
    "\"아 그리고\", \"아 맞다\" 등 감탄사와 구어체가 토큰을 소모",
    "\"혹시 셀레니움도 필요하면\" — 조건 없이 모호한 요청은 불필요한 코드를 유발",
    "요구사항이 문장 속에 흩어져 있어 LLM이 일부를 누락할 가능성이 높음",
    "\"엄청 자세하게\" 같은 형용사는 토큰 낭비 대비 효과가 없음"
  ],
  tips: [
    "요구사항을 번호 리스트로 구조화하면 누락 없이 정확한 응답을 받을 수 있음",
    "출력 조건(언어, 형식, 제약)을 별도 섹션으로 분리하면 품질이 올라감",
    "불확실한 기능(Selenium 등)은 조건부 지시로 명확하게 처리",
    "감탄사, 중복 표현을 제거하면 동일 의미로 토큰을 40% 이상 절감 가능",
    "하나의 프롬프트에 하나의 목적만 담는 것이 최적의 결과를 보장"
  ],
  score_before: 32,
  score_after: 87
};

const MODELS = [
  { name: "Claude Opus 4", input: 15, output: 75, vendor: "Anthropic", hue: 12 },
  { name: "Claude Sonnet 4", input: 3, output: 15, vendor: "Anthropic", hue: 28 },
  { name: "Claude Haiku 3.5", input: 0.8, output: 4, vendor: "Anthropic", hue: 142 },
  { name: "GPT-4o", input: 2.5, output: 10, vendor: "OpenAI", hue: 200 },
  { name: "GPT-4o mini", input: 0.15, output: 0.6, vendor: "OpenAI", hue: 210 },
  { name: "Gemini 2.5 Pro", input: 1.25, output: 10, vendor: "Google", hue: 265 },
  { name: "Gemini 2.5 Flash", input: 0.15, output: 0.6, vendor: "Google", hue: 280 },
];

const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PromptForge</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Outfit:wght@300;400;600;700;800&family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#111110;--surface:#1a1918;--border:rgba(255,255,255,.06);--t1:#e8e0d8;--t2:#a09890;--t3:#605850;--accent:#c4704a;--accent2:#d4956a;--green:#5ab468;--red:#d45a5a}
body{background:var(--bg);color:var(--t1);font-family:'Noto Sans KR','Outfit',sans-serif;min-height:100vh;overflow-x:hidden}
::selection{background:var(--accent);color:#fff}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:18px 32px;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:99;background:rgba(17,17,16,.85);backdrop-filter:blur(24px)}
.logo-area{display:flex;align-items:center;gap:12px}
.logo-mark{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:grid;place-items:center;font-size:16px;font-weight:700;color:#fff;letter-spacing:-1px;box-shadow:0 2px 12px rgba(196,112,74,.35)}
.logo-text{font-family:'Outfit',sans-serif;font-weight:700;font-size:17px;letter-spacing:-.6px;color:var(--t1)}
.logo-sub{font-size:10.5px;color:var(--t3);letter-spacing:.3px;margin-top:1px}
.tabs{display:flex;gap:1px;background:rgba(255,255,255,.03);border-radius:9px;padding:3px}
.tab{padding:7px 16px;border:none;border-radius:7px;background:transparent;color:var(--t3);font-size:12.5px;cursor:pointer;font-family:'Outfit',sans-serif;font-weight:400;transition:.15s}
.tab.on{background:rgba(196,112,74,.13);color:var(--accent);font-weight:600}
.wrap{max-width:920px;margin:0 auto;padding:28px 20px 60px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:18px}
.card-title{font-family:'Outfit',sans-serif;font-weight:600;font-size:13.5px;color:var(--t1);margin-bottom:12px;display:flex;align-items:center;justify-content:space-between}
textarea{width:100%;min-height:130px;background:rgba(0,0,0,.35);border:1px solid var(--border);border-radius:9px;padding:14px;color:#ccc;font-size:12.5px;line-height:1.75;font-family:'JetBrains Mono',monospace;resize:vertical;outline:none;transition:border .2s}
textarea:focus{border-color:rgba(196,112,74,.35)}
textarea::placeholder{color:var(--t3)}
.bar-row{display:flex;justify-content:space-between;align-items:center;margin-top:12px}
.meta{display:flex;gap:18px;font-size:11.5px;font-family:'JetBrains Mono',monospace;color:var(--t3)}
.meta b{color:var(--t2);font-weight:600}
.btn{padding:9px 26px;border:none;border-radius:9px;font-family:'Outfit',sans-serif;font-weight:600;font-size:13.5px;cursor:pointer;transition:.2s}
.btn-primary{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;box-shadow:0 3px 16px rgba(196,112,74,.3)}
.btn-primary:hover{box-shadow:0 3px 24px rgba(196,112,74,.45);transform:translateY(-1px)}
.btn-primary:disabled{opacity:.35;cursor:default;transform:none;box-shadow:none}
.btn-ghost{background:rgba(255,255,255,.04);border:1px solid var(--border);color:var(--t2);font-size:11.5px;padding:5px 13px;font-family:'JetBrains Mono',monospace;cursor:pointer}
.btn-ghost:hover{border-color:rgba(255,255,255,.12)}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:14px;text-align:center}
.stat-label{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:var(--t3);font-family:'JetBrains Mono',monospace;margin-bottom:6px}
.stat-val{font-size:21px;font-weight:700;font-family:'Outfit',sans-serif}
.diff{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
.diff-col label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;font-family:'JetBrains Mono',monospace;margin-bottom:7px}
.diff-col label.before{color:var(--red)}
.diff-col label.after{color:var(--green)}
.diff-box{border-radius:9px;padding:14px;font-size:12px;line-height:1.75;font-family:'JetBrains Mono',monospace;white-space:pre-wrap;word-break:break-word;max-height:280px;overflow-y:auto}
.diff-box.before{background:rgba(212,90,90,.04);border:1px solid rgba(212,90,90,.12);color:var(--t2)}
.diff-box.after{background:rgba(90,180,104,.04);border:1px solid rgba(90,180,104,.12);color:#c8c8c8}
.analysis{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
.issue-item,.tip-item{font-size:11.5px;color:var(--t2);line-height:1.65;padding:7px 0;border-bottom:1px solid var(--border);font-family:'JetBrains Mono',monospace}
.issue-item:last-child,.tip-item:last-child{border:none}
.score-box{margin-top:12px;padding:10px 14px;border-radius:8px;display:flex;align-items:center;gap:12px}
.score-box .num{font-size:26px;font-weight:700;font-family:'Outfit',sans-serif}
.score-box .of{font-size:13px;color:var(--t3)}
.cost-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.cost-name{width:130px;text-align:right;font-size:11.5px;color:var(--t2);font-family:'JetBrains Mono',monospace;flex-shrink:0}
.cost-track{flex:1;height:26px;background:rgba(255,255,255,.02);border-radius:5px;overflow:hidden}
.cost-fill{height:100%;border-radius:5px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;transition:width .7s cubic-bezier(.16,1,.3,1)}
.cost-fill span{font-size:10px;color:#fff;font-family:'JetBrains Mono',monospace;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.5)}
.cost-vendor{width:55px;font-size:9.5px;color:var(--t3);font-family:'JetBrains Mono',monospace}
.price-table{width:100%;border-collapse:collapse;font-size:11.5px;font-family:'JetBrains Mono',monospace}
.price-table th{padding:9px 10px;text-align:left;color:var(--t3);font-weight:400;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid rgba(255,255,255,.08)}
.price-table td{padding:10px;border-bottom:1px solid var(--border)}
.guide-card{margin-bottom:16px}
.guide-title{font-family:'Outfit',sans-serif;font-weight:600;font-size:14px;margin-bottom:5px}
.guide-desc{font-size:12.5px;color:var(--t2);margin-bottom:12px;line-height:1.6}
.guide-pair{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.guide-ex{border-radius:8px;padding:11px;font-size:11.5px;font-family:'JetBrains Mono',monospace;line-height:1.6}
.guide-ex.bad{background:rgba(212,90,90,.04);border:1px solid rgba(212,90,90,.1);color:var(--t2)}
.guide-ex.good{background:rgba(90,180,104,.04);border:1px solid rgba(90,180,104,.1);color:#c8c8c8}
.guide-ex .tag{display:block;font-size:9.5px;margin-bottom:3px}
.savings{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.save-card{background:rgba(0,0,0,.25);border-radius:9px;padding:14px;text-align:center}
.save-card .amt{font-size:21px;font-weight:700;color:var(--green);font-family:'Outfit',sans-serif}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--border);text-align:center;font-size:10px;color:var(--t3);font-family:'JetBrains Mono',monospace;opacity:.5}
.loading{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.15);border-top-color:var(--accent);border-radius:50%;animation:spin .6s linear infinite;margin-right:8px;vertical-align:middle}
@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:700px){.stats{grid-template-columns:repeat(2,1fr)}.diff,.analysis,.guide-pair{grid-template-columns:1fr}.hdr{flex-direction:column;gap:10px;padding:14px 16px}.wrap{padding:16px 12px 40px}}
</style>
</head>
<body>
<div class="hdr">
  <div class="logo-area">
    <div class="logo-mark">Pf</div>
    <div><div class="logo-text">PromptForge</div><div class="logo-sub">Token Optimization Platform</div></div>
  </div>
  <div class="tabs">
    <button class="tab on" onclick="switchTab('optimize')">최적화</button>
    <button class="tab" onclick="switchTab('cost')">비용 비교</button>
    <button class="tab" onclick="switchTab('guide')">작성 가이드</button>
  </div>
</div>
<div class="wrap">
  <div id="tab-optimize">
    <div class="card">
      <div class="card-title"><span>프롬프트 입력</span><button class="btn-ghost" onclick="loadExample()">예시 불러오기</button></div>
      <textarea id="input" placeholder="최적화할 프롬프트를 여기에 붙여넣으세요..."></textarea>
      <div class="bar-row">
        <div class="meta"><span><b id="tkn-count">0</b> tokens</span><span><b id="chr-count">0</b> chars</span></div>
        <button class="btn btn-primary" id="run-btn" onclick="optimize()">최적화 실행</button>
      </div>
    </div>
    <div id="stats-area"></div>
    <div id="diff-area"></div>
    <div id="analysis-area"></div>
  </div>
  <div id="tab-cost" style="display:none">
    <div class="card">
      <div class="card-title">모델별 비용 비교</div>
      <div id="cost-desc" style="font-size:12px;color:var(--t3);margin-bottom:16px">프롬프트를 입력하면 실제 토큰 기반으로 비용이 계산됩니다</div>
      <div id="cost-chart"></div>
    </div>
    <div class="card">
      <div class="card-title">모델별 토큰 단가 (1M 토큰당 USD)</div>
      <table class="price-table"><thead><tr><th>모델</th><th>제공사</th><th>입력</th><th>출력</th><th>1K 호출*</th></tr></thead><tbody id="price-body"></tbody></table>
      <div style="font-size:10px;color:var(--t3);margin-top:10px">* 평균 500 입력 + 500 출력 토큰 기준</div>
    </div>
    <div id="savings-area"></div>
  </div>
  <div id="tab-guide" style="display:none"></div>
  <div class="footer">PromptForge v0.1</div>
</div>
<script>
const MODELS=${JSON.stringify(MODELS)};
const EXAMPLE="나는 파이썬으로 웹 스크래핑을 하고 싶은데, 뭐 일단 BeautifulSoup이라는 라이브러리가 있다고 들었거든? 근데 잘 모르겠어서 그냥 다 알려줘. 아 그리고 requests도 써야 한다면서? 그것도 같이. 일단 네이버 뉴스 페이지에서 뉴스 제목이랑 링크를 다 가져오고 싶은데, 에러 처리도 해주고, CSV로 저장도 해주고, 로그도 남겨주고, 그리고 혹시 셀레니움도 필요하면 그것도 넣어줘. 아 맞다 그리고 코드에 주석도 엄청 자세하게 달아줘. 한국어로. 그리고 가능하면 클래스로 만들어서 재사용 가능하게 해줘. 아 참 그리고 실행 방법도 알려주고 pip install 명령어도 알려줘.";
const HARDCODED=${JSON.stringify(HARDCODED)};
const GUIDES=[
  {t:"명확한 목표 설정",d:'"다 알려줘" 대신 구체적인 결과물을 지정하세요.',b:"파이썬 웹 크롤링 다 알려줘",g:"BeautifulSoup으로 네이버 뉴스 제목 추출하는 함수 작성"},
  {t:"군더더기 제거",d:"감탄사, 중복 표현, 불필요한 맥락을 제거하세요.",b:"아 그리고 혹시 가능하면 에러처리도 해주면 좋을 것 같은데 할 수 있으면 해줘",g:"try-except로 HTTP 에러 처리 포함"},
  {t:"구조화된 요청",d:"요구사항을 번호나 구조로 정리하면 토큰도 줄고 정확도도 높아집니다.",b:"그리고 CSV도 저장하고 로그도 남기고 클래스로 만들어줘",g:"요구사항: 1) CSV 저장 2) logging 모듈 사용 3) 클래스 구조"},
  {t:"요청 분리",d:"여러 작업을 하나의 프롬프트에 넣으면 토큰 낭비와 품질 저하가 생깁니다.",b:"크롤러도 만들고 API도 만들고 프론트엔드도 만들어줘",g:"각 기능별 개별 프롬프트로 분리하여 순차 요청"},
  {t:"출력 형식 지정",d:"원하는 출력 형식을 미리 지정하면 재시도를 줄일 수 있습니다.",b:"코드 짜줘",g:"Python 3.12, docstring 포함, 타입힌트, 실행 가능한 코드 블록으로 응답"}
];
let state={optimized:"",savedTokens:0,savedPct:0,inputTokens:0,outputTokens:0};
function estimateTokens(t){if(!t)return 0;const kr=(t.match(/[\\uAC00-\\uD7AF\\u1100-\\u11FF\\u3130-\\u318F]/g)||[]).length;return Math.ceil(kr/1.5+(t.length-kr)/4)}
function $(id){return document.getElementById(id)}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function switchTab(name){['optimize','cost','guide'].forEach(t=>{$('tab-'+t).style.display=t===name?'block':'none'});document.querySelectorAll('.tab').forEach((b,i)=>{b.classList.toggle('on',['optimize','cost','guide'][i]===name)});if(name==='cost')renderCost()}
$('input').addEventListener('input',function(){const t=estimateTokens(this.value);$('tkn-count').textContent=t.toLocaleString();$('chr-count').textContent=this.value.length.toLocaleString();state.inputTokens=t});
function loadExample(){$('input').value=EXAMPLE;$('input').dispatchEvent(new Event('input'))}
async function optimize(){const prompt=$('input').value.trim();if(!prompt)return;const btn=$('run-btn');btn.disabled=true;btn.innerHTML='<span class="loading"></span>분석 중...';$('stats-area').innerHTML='';$('diff-area').innerHTML='';$('analysis-area').innerHTML='';await new Promise(r=>setTimeout(r,1800));const data=HARDCODED;state.optimized=data.optimized;state.outputTokens=estimateTokens(data.optimized);state.savedTokens=state.inputTokens-state.outputTokens;state.savedPct=state.inputTokens>0?((state.savedTokens/state.inputTokens)*100):0;renderStats();renderDiff(prompt,data.optimized);renderAnalysis(data);btn.disabled=false;btn.textContent='최적화 실행'}
function renderStats(){const items=[{label:'BEFORE',val:state.inputTokens,unit:'tkn',color:'var(--red)'},{label:'AFTER',val:state.outputTokens,unit:'tkn',color:'var(--green)'},{label:'절감량',val:state.savedTokens,unit:'tkn',color:'var(--accent2)'},{label:'절감률',val:state.savedPct.toFixed(1),unit:'%',color:'#6aa8c0'}];$('stats-area').innerHTML='<div class="stats">'+items.map(s=>'<div class="stat-card"><div class="stat-label">'+s.label+'</div><div class="stat-val" style="color:'+s.color+'">'+s.val+'<span style="font-size:12px;color:var(--t3);margin-left:2px">'+s.unit+'</span></div></div>').join('')+'</div>'}
function renderDiff(orig,opt){$('diff-area').innerHTML='<div class="diff"><div class="diff-col"><label class="before">✕ Before</label><div class="diff-box before">'+esc(orig)+'</div></div><div class="diff-col"><label class="after">✓ After</label><div class="diff-box after">'+esc(opt)+'</div></div></div>'}
function renderAnalysis(d){$('analysis-area').innerHTML='<div class="analysis"><div class="card" style="margin:0"><div class="card-title" style="color:var(--red)">발견된 문제점</div>'+(d.issues||[]).map(i=>'<div class="issue-item"><span style="color:var(--red);margin-right:6px">•</span>'+esc(i)+'</div>').join('')+'<div class="score-box" style="background:rgba(212,90,90,.06)"><div class="num" style="color:var(--red)">'+(d.score_before||0)+'</div><div class="of">/100</div></div></div><div class="card" style="margin:0"><div class="card-title" style="color:var(--green)">개선 포인트</div>'+(d.tips||[]).map(t=>'<div class="tip-item"><span style="color:var(--green);margin-right:6px">✓</span>'+esc(t)+'</div>').join('')+'<div class="score-box" style="background:rgba(90,180,104,.06)"><div class="num" style="color:var(--green)">'+(d.score_after||0)+'</div><div class="of">/100</div></div></div></div>'}
function renderCost(){const inp=state.inputTokens||1000;const out=state.inputTokens?state.inputTokens*2:2000;if(state.inputTokens>0)$('cost-desc').textContent='입력 '+inp.toLocaleString()+' 토큰 + 예상 출력 '+out.toLocaleString()+' 토큰 기준';const costs=MODELS.map(m=>({...m,total:(inp/1e6)*m.input+(out/1e6)*m.output}));const max=Math.max(...costs.map(c=>c.total));$('cost-chart').innerHTML=costs.map(m=>{const pct=Math.max((m.total/max)*100,3);const c='hsl('+m.hue+',55%,60%)';const price=m.total<.001?m.total.toExponential(1):m.total.toFixed(4);return'<div class="cost-row"><div class="cost-name">'+m.name+'</div><div class="cost-track"><div class="cost-fill" style="width:'+pct+'%;background:linear-gradient(90deg,hsl('+m.hue+',55%,30%),'+c+')"><span>$'+price+'</span></div></div><div class="cost-vendor">'+m.vendor+'</div></div>'}).join('');$('price-body').innerHTML=MODELS.map(m=>{const c='hsl('+m.hue+',55%,60%)';const per1k=((500/1e6)*m.input+(500/1e6)*m.output)*1000;return'<tr><td style="color:'+c+';font-weight:600">'+m.name+'</td><td style="color:var(--t2)">'+m.vendor+'</td><td style="color:var(--t2)">$'+m.input.toFixed(2)+'</td><td style="color:var(--t2)">$'+m.output.toFixed(2)+'</td><td style="color:var(--t1)">$'+per1k.toFixed(2)+'</td></tr>'}).join('');if(state.optimized){const sv=(state.savedTokens/1e6)*3;$('savings-area').innerHTML='<div class="card" style="border-color:rgba(90,180,104,.15);background:linear-gradient(135deg,rgba(90,180,104,.04),rgba(100,170,200,.04))"><div class="card-title" style="color:var(--green)">최적화 시 예상 절감 효과 (Sonnet 기준)</div><div class="savings">'+[{l:'일 100회',m:3000},{l:'일 500회',m:15000},{l:'일 2,000회',m:60000}].map(s=>'<div class="save-card"><div style="font-size:10.5px;color:var(--t3);margin-bottom:6px">'+s.l+'</div><div class="amt">$'+(sv*s.m).toFixed(2)+'</div><div style="font-size:10px;color:var(--t3);margin-top:2px">월간 절감</div></div>').join('')+'</div></div>'}}
$('tab-guide').innerHTML=GUIDES.map(g=>'<div class="card guide-card"><div class="guide-title">'+g.t+'</div><div class="guide-desc">'+g.d+'</div><div class="guide-pair"><div class="guide-ex bad"><span class="tag" style="color:var(--red)">✕ BAD</span>'+esc(g.b)+'</div><div class="guide-ex good"><span class="tag" style="color:var(--green)">✓ GOOD</span>'+esc(g.g)+'</div></div></div>').join('');
renderCost();
</script>
</body>
</html>`;

http.createServer((req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(HTML);
}).listen(PORT, () => {
  console.log("");
  console.log("  ✅ PromptForge 실행 중");
  console.log("  ➜ 브라우저에서 열기: http://localhost:" + PORT);
  console.log("  ➜ 종료: Ctrl + C");
  console.log("");
});
