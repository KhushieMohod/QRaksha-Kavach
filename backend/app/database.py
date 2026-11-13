"""Database engine and session setup for SQLite."""

from sqlmodel import SQLModel, Session, create_engine

DATABASE_URL = "sqlite:///./qraksha.db"

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


def create_db_and_tables() -> None:
    """Create all tables defined by SQLModel metadata."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """Yield a database session for FastAPI dependency injection."""
    with Session(engine) as session:
        yield session

