from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import get_db
from models import PromptHistory, User
from auth import decode_token

router = APIRouter(prefix="/history", tags=["history"])

# ── 요청/응답 스키마 ───────────────────────────────────────
class HistorySaveRequest(BaseModel):
    original_prompt: str
    optimized_prompt: str
    original_tokens: int
    optimized_tokens: int
    saved_tokens: int
    saved_percent: float
    issue_count: int = 0

class HistoryResponse(BaseModel):
    id: int
    original_prompt: str
    optimized_prompt: str
    original_tokens: int
    optimized_tokens: int
    saved_tokens: int
    saved_percent: float
    issue_count: int
    created_at: datetime

    class Config:
        from_attributes = True

# ── 토큰에서 유저 꺼내는 헬퍼 ──────────────────────────────
def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={"error": "로그인이 필요해요.", "code": "UNAUTHORIZED"}
        )
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail={"error": "액세스 토큰이 아니에요.", "code": "INVALID_TOKEN_TYPE"}
        )
    user_id = int(payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail={"error": "유효하지 않은 사용자예요.", "code": "USER_NOT_FOUND"}
        )
    return user

# ── 엔드포인트 ─────────────────────────────────────────────

@router.post("", status_code=201, response_model=HistoryResponse)
def save_history(
    req: HistorySaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """로그인한 유저의 /optimize 결과를 히스토리로 저장"""
    history = PromptHistory(
        user_id=current_user.id,
        original_prompt=req.original_prompt,
        optimized_prompt=req.optimized_prompt,
        original_tokens=req.original_tokens,
        optimized_tokens=req.optimized_tokens,
        saved_tokens=req.saved_tokens,
        saved_percent=req.saved_percent,
        issue_count=req.issue_count,
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return history


@router.get("", response_model=list[HistoryResponse])
def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """로그인한 유저의 히스토리 목록 조회 (최신순)"""
    histories = (
        db.query(PromptHistory)
        .filter(PromptHistory.user_id == current_user.id)
        .order_by(PromptHistory.created_at.desc())
        .all()
    )
    return histories


@router.delete("/{history_id}", status_code=204)
def delete_history(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """히스토리 항목 삭제 (본인 것만 가능)"""
    history = db.query(PromptHistory).filter(
        PromptHistory.id == history_id,
        PromptHistory.user_id == current_user.id
    ).first()
    if not history:
        raise HTTPException(
            status_code=404,
            detail={"error": "히스토리를 찾을 수 없어요.", "code": "NOT_FOUND"}
        )
    db.delete(history)
    db.commit()
    return None