from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    nickname = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    histories = relationship("PromptHistory", back_populates="user")

    def __repr__(self):
        return f"<User id={self.id} email={self.email}>"


class PromptHistory(Base):
    __tablename__ = "prompt_histories"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    original_prompt = Column(Text, nullable=False)
    optimized_prompt = Column(Text, nullable=False)
    original_tokens = Column(Integer, nullable=False)
    optimized_tokens = Column(Integer, nullable=False)
    saved_tokens = Column(Integer, nullable=False)
    saved_percent = Column(Float, nullable=False)
    issue_count = Column(Integer, default=0)       # 발견된 이슈 개수
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="histories")

    def __repr__(self):
        return f"<PromptHistory id={self.id} user_id={self.user_id}>"