from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

class ModuleLog(Base):
    __tablename__ = "module_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    action = Column(String) # update, install
    module_type = Column(String) # backend, frontend
    module_name = Column(String)
    from_version = Column(String, nullable=True)
    to_version = Column(String)
    status = Column(String) # success, failed
    
    user_id = Column(String, ForeignKey("users.id"))
    user = relationship("User")

class TrainingLog(Base):
    __tablename__ = "training_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    duration_seconds = Column(Integer, default=0)
    epoch_count = Column(Integer, default=0)
    status = Column(String) # running, success, failed
    log_output = Column(String, nullable=True)
    
    user_id = Column(String, ForeignKey("users.id"))
    user = relationship("User")
