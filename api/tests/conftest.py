import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from app.db.base import Base
from app.db import models  # Register every table.


@pytest.fixture
def session():
    engine = create_engine("sqlite://")
    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()
