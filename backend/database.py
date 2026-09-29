from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# SQLite: 파일 기반 DB (backend/ 폴더 안에 minifi.db 파일 생성됨)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./minifi.db")

# Railway 등 일부 PostgreSQL 제공자가 예전 스킴(postgres://)으로 URL을 주는 경우가 있는데,
# SQLAlchemy 1.4+는 postgresql://만 인식함 -- 방어적으로 여기서 교체.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# PostgreSQL로 바꿀 때는 .env에서 DATABASE_URL만 교체하면 됨
# DATABASE_URL=postgresql://user:password@host/dbname

# SQLite는 기본적으로 커넥션 하나를 한 스레드에서만 쓰게 강제함(check_same_thread) --
# FastAPI가 여러 스레드에서 같은 세션을 다룰 수 있어서 SQLite일 때만 이 옵션을 꺼줘야 함.
# PostgreSQL(psycopg2)은 이 옵션 자체를 모르므로 전달하면 TypeError가 남 -- SQLite일 때만 넘김.
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=_connect_args,
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