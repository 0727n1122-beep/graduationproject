from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# SQLite: 파일 기반 DB (backend/ 폴더 안에 minifi.db 파일 생성됨)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./minifi.db")

# PostgreSQL로 바꿀 때는 .env에서 DATABASE_URL만 교체하면 됨
# DATABASE_URL=postgresql://user:password@host/dbname

engine = create_engine(
    DATABASE_URL,
    # SQLite 전용 옵션 (PostgreSQL로 바꾸면 이 줄 삭제)
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# DB 세션 의존성 주입용 (FastAPI endpoint에서 사용)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()