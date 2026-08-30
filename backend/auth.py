from fastapi import APIRouter, Depends, HTTPException, status, Header
from typing import Optional
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from database import get_db
from models import User
import os
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_auth_requests

router = APIRouter(prefix="/auth", tags=["auth"])

# ── 설정 ──────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── 요청/응답 스키마 ───────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    nickname: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class GoogleLoginRequest(BaseModel):
    credential: str  # 프론트에서 받은 구글 ID 토큰(JWT)

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class UpdateMeRequest(BaseModel):
    nickname: str

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

def get_current_user(
    authorization: Optional[str] = Header(None), db: Session = Depends(get_db)
) -> User:
    """Authorization: Bearer <access_token> 헤더로 로그인된 유저를 조회.
    /me, /me(PATCH), /me(DELETE) 등 인증이 필요한 엔드포인트가 공통으로 사용."""
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
    if not user:
        raise HTTPException(
            status_code=401,
            detail={"error": "사용자를 찾을 수 없어요.", "code": "USER_NOT_FOUND"}
        )
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail={"error": "비활성화된 계정이에요.", "code": "ACCOUNT_DISABLED"}
        )
    return user

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


@router.post("/google", response_model=TokenResponse)
def google_login(req: GoogleLoginRequest, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail={"error": "구글 로그인이 서버에 설정되어 있지 않아요.", "code": "GOOGLE_NOT_CONFIGURED"}
        )
    try:
        idinfo = google_id_token.verify_oauth2_token(
            req.credential, google_auth_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail={"error": "구글 인증에 실패했어요.", "code": "INVALID_GOOGLE_TOKEN"}
        )

    google_sub = idinfo["sub"]
    email = idinfo.get("email")
    email_verified = idinfo.get("email_verified", False)
    name = idinfo.get("name") or (email.split("@")[0] if email else "사용자")

    if not email or not email_verified:
        raise HTTPException(
            status_code=401,
            detail={"error": "이메일이 확인되지 않은 구글 계정이에요.", "code": "EMAIL_NOT_VERIFIED"}
        )

    # 1) google_id로 기존 유저 조회
    user = db.query(User).filter(User.google_id == google_sub).first()

    if not user:
        # 2) 이메일로 가입된 기존 계정이 있으면 구글 계정 연결
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.google_id = google_sub
        else:
            # 3) 완전 신규 유저 생성 (비밀번호 없음)
            user = User(
                email=email,
                password_hash=None,
                google_id=google_sub,
                nickname=name[:50],
            )
            db.add(user)
        db.commit()
        db.refresh(user)

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
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    req: UpdateMeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """마이페이지 닉네임 변경."""
    nickname = req.nickname.strip()
    if len(nickname) < 2 or len(nickname) > 20:
        raise HTTPException(
            status_code=400,
            detail={"error": "닉네임은 2~20자 사이여야 해요.", "code": "INVALID_NICKNAME"}
        )
    current_user.nickname = nickname
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me")
def delete_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """회원 탈퇴 — is_active를 꺼서 소프트 삭제 처리(스키마 변경 없음).
    이메일/구글 계정 자체는 남겨두므로, 같은 이메일로 재가입은 별도 정책이 필요하면
    나중에 추가 처리(이메일 익명화 등)를 고려."""
    current_user.is_active = False
    db.commit()
    return {"message": "회원 탈퇴가 완료됐어요."}