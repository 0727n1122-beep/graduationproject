from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from database import get_db
from models import User
import os

router = APIRouter(prefix="/auth", tags=["auth"])

# ── 설정 ──────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── 요청/응답 스키마 ───────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    nickname: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class UserResponse(BaseModel):
    id: int
    email: str
    nickname: str
    created_at: datetime

    class Config:
        from_attributes = True

# ── 유틸 함수 ──────────────────────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(data: dict, expires_delta: timedelta) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_access_token(user_id: int) -> str:
    return create_token(
        {"sub": str(user_id), "type": "access"},
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

def create_refresh_token(user_id: int) -> str:
    return create_token(
        {"sub": str(user_id), "type": "refresh"},
        timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "토큰이 유효하지 않거나 만료됐어요.", "code": "INVALID_TOKEN"}
        )

# ── 엔드포인트 ─────────────────────────────────────────────

@router.post("/register", status_code=201, response_model=UserResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # 비밀번호 길이 검증
    if len(req.password) < 8:
        raise HTTPException(
            status_code=400,
            detail={"error": "비밀번호는 8자 이상이어야 해요.", "code": "PASSWORD_TOO_SHORT"}
        )
    # 닉네임 길이 검증
    if len(req.nickname) < 2 or len(req.nickname) > 20:
        raise HTTPException(
            status_code=400,
            detail={"error": "닉네임은 2~20자 사이여야 해요.", "code": "INVALID_NICKNAME"}
        )
    # 이메일 중복 확인
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"error": "이미 가입된 이메일이에요.", "code": "DUPLICATE_EMAIL"}
        )
    # 유저 생성
    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        nickname=req.nickname,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    # 이메일 없거나 비밀번호 불일치
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail={"error": "이메일 또는 비밀번호가 틀렸어요.", "code": "INVALID_CREDENTIALS"}
        )
    # 비활성화된 계정
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail={"error": "비활성화된 계정이에요.", "code": "ACCOUNT_DISABLED"}
        )
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/logout")
def logout():
    # 현재는 클라이언트에서 토큰 삭제로 처리
    # 추후 refresh_token DB 저장 방식으로 전환 시 여기서 DB에서 삭제
    return {"message": "로그아웃 되었습니다."}


@router.post("/refresh", response_model=TokenResponse)
def refresh(req: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(req.refresh_token)
    # refresh 타입 토큰인지 확인
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=401,
            detail={"error": "리프레시 토큰이 아니에요.", "code": "INVALID_TOKEN_TYPE"}
        )
    user_id = int(payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail={"error": "유효하지 않은 사용자예요.", "code": "USER_NOT_FOUND"}
        )
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserResponse)
def me(token: str, db: Session = Depends(get_db)):
    # 실제로는 Authorization 헤더에서 Bearer 토큰 추출해야 함
    # 지금은 테스트 편의를 위해 쿼리 파라미터로 받음 → 프론트 연결 시 수정 필요
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail={"error": "액세스 토큰이 아니에요.", "code": "INVALID_TOKEN_TYPE"}
        )
    user_id = int(payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=401,
            detail={"error": "사용자를 찾을 수 없어요.", "code": "USER_NOT_FOUND"}
        )
    return user