from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import anthropic
import os
import json

router = APIRouter(prefix="/error-coach", tags=["error-coach"])

client = anthropic.Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY"),
    base_url=os.getenv("ANTHROPIC_BASE_URL"),
)

# ── 에러 타입별 가이드 사전 ────────────────────────────────
ERROR_GUIDES = {
    "MODULE_NOT_FOUND": {
        "title": "모듈을 찾을 수 없음",
        "tip": "필요한 라이브러리가 설치되지 않았어요",
        "suggested_fix": "터미널에 pip install [모듈명] 을 입력해보세요"
    },
    "SYNTAX_ERROR": {
        "title": "코드 문법 오류",
        "tip": "코드의 문법이 잘못됐어요",
        "suggested_fix": "콜론(:), 괄호, 들여쓰기를 확인해보세요"
    },
    "TYPE_ERROR": {
        "title": "자료형 불일치",
        "tip": "서로 다른 종류의 값을 섞어서 사용했어요",
        "suggested_fix": "숫자와 문자를 섞어 쓰지는 않았는지 확인해보세요"
    },
    "INDEX_ERROR": {
        "title": "범위 초과 접근",
        "tip": "리스트의 범위를 벗어난 위치에 접근했어요",
        "suggested_fix": "리스트의 길이보다 큰 번호를 요청하지 않았는지 확인해보세요"
    },
    "NAME_ERROR": {
        "title": "정의되지 않은 변수",
        "tip": "사용하려는 변수나 함수가 아직 정의되지 않았어요",
        "suggested_fix": "변수명 오타는 없는지, 먼저 선언했는지 확인해보세요"
    },
    "FILE_NOT_FOUND": {
        "title": "파일을 찾을 수 없음",
        "tip": "지정한 경로에 파일이 없어요",
        "suggested_fix": "파일 경로나 파일명을 다시 확인해보세요"
    },
    "PERMISSION_ERROR": {
        "title": "권한 없음",
        "tip": "해당 파일이나 폴더에 접근할 권한이 없어요",
        "suggested_fix": "관리자 권한으로 실행하거나 파일 권한을 확인해보세요"
    },
    "CONNECTION_ERROR": {
        "title": "연결 오류",
        "tip": "서버나 인터넷에 연결할 수 없어요",
        "suggested_fix": "인터넷 연결 상태와 서버 주소를 확인해보세요"
    },
    "VALUE_ERROR": {
        "title": "잘못된 값",
        "tip": "함수에 올바르지 않은 값을 전달했어요",
        "suggested_fix": "입력값의 형식이나 범위가 올바른지 확인해보세요"
    },
    "UNKNOWN": {
        "title": "알 수 없는 에러",
        "tip": "에러 원인을 특정하기 어려워요",
        "suggested_fix": "에러 메시지 전체를 검색엔진에 복사해서 검색해보세요"
    },
}

# ── 요청/응답 스키마 ───────────────────────────────────────
class ErrorCoachRequest(BaseModel):
    error_message: str
    context: Optional[str] = None

class ErrorCoachResponse(BaseModel):
    error_type: str
    plain_explanation: str
    likely_cause: str
    suggested_fix: str
    confidence: float
    guide: dict

# ── 엔드포인트 ─────────────────────────────────────────────
@router.post("", response_model=ErrorCoachResponse)
async def error_coach(request: ErrorCoachRequest):
    error_message = request.error_message
    context = request.context

    # 입력 검증
    if not error_message or not error_message.strip():
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail={"error": "에러 메시지를 입력해주세요.", "code": "EMPTY_ERROR_MESSAGE"}
        )
    if len(error_message) > 2000:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail={"error": "에러 메시지가 너무 깁니다. 2000자 이하로 입력해주세요.", "code": "TOO_LONG"}
        )
    if len(error_message.strip()) < 5:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail={"error": "에러 메시지가 너무 짧습니다.", "code": "TOO_SHORT"}
        )

    # 컨텍스트 프롬프트 구성
    context_text = f"\n\n[작업 컨텍스트]\n{context}" if context else ""

    # Claude API 호출
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1000,
        messages=[
            {
                "role": "user",
                "content": f"""당신은 비개발자(바이브코더)를 위한 친절한 에러 코치입니다.
사용자가 AI로 만든 코드를 실행하다 마주친 에러를 쉬운 말로 설명해주세요.

[에러 메시지]
{error_message}{context_text}

[JSON 스키마]
{{
  "error_type": "MODULE_NOT_FOUND | SYNTAX_ERROR | TYPE_ERROR | INDEX_ERROR | NAME_ERROR | FILE_NOT_FOUND | PERMISSION_ERROR | CONNECTION_ERROR | VALUE_ERROR | UNKNOWN",
  "plain_explanation": "이 에러가 무슨 뜻인지 비개발자도 이해할 수 있게 1~2문장으로 설명 (예: '이 에러는 ~라는 뜻이에요')",
  "likely_cause": "가장 유력한 원인 1~2문장",
  "suggested_fix": "구체적인 해결 방법. 터미널 명령어가 필요하면 포함",
  "confidence": 0.0~1.0 사이 숫자
}}

[출력 규칙]
- 순수 JSON만 출력. 백틱, 설명 문장 금지.
- 첫 글자는 {{, 마지막 글자는 }}.
- 비개발자가 이해할 수 있는 쉬운 말로 설명.
- suggested_fix는 구체적인 액션으로 (막연한 "확인해보세요" 금지).

JSON으로만 응답하세요."""
            }
        ]
    )

    # 응답 파싱
    try:
        response_text = message.content[0].text.strip()
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        if start != -1 and end != 0:
            response_text = response_text[start:end]
        result = json.loads(response_text)
    except (json.JSONDecodeError, IndexError):
        return ErrorCoachResponse(
            error_type="UNKNOWN",
            plain_explanation="에러 분석에 실패했어요. 다시 시도해주세요.",
            likely_cause="분석 중 오류가 발생했어요.",
            suggested_fix="에러 메시지를 검색엔진에 복사해서 검색해보세요.",
            confidence=0.0,
            guide=ERROR_GUIDES["UNKNOWN"]
        )

    error_type = result.get("error_type", "UNKNOWN")
    guide = ERROR_GUIDES.get(error_type, ERROR_GUIDES["UNKNOWN"])

    return ErrorCoachResponse(
        error_type=error_type,
        plain_explanation=result.get("plain_explanation", ""),
        likely_cause=result.get("likely_cause", ""),
        suggested_fix=result.get("suggested_fix", ""),
        confidence=result.get("confidence", 0.8),
        guide=guide
    )