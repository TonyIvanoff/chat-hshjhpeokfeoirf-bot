from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Text
from sqlalchemy.orm import relationship
from app.db.session import Base

class ServiceRequest(Base):
    __tablename__ = "service_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending")  # pending, processed, quoted, accepted
    
    # Locations
    pickup_address = Column(String, nullable=False)
    delivery_address = Column(String, nullable=False)
    
    # Route info (calculated later)
    distance_km = Column(Float, nullable=True)
    estimated_price = Column(Float, nullable=True)

    items = relationship("Item", back_populates="request", cascade="all, delete-orphan")
    images = relationship("RequestImage", back_populates="request", cascade="all, delete-orphan")
    user = relationship("app.models.user.User") # Backref

    @property
    def display_id(self):
        return f"shift-{self.id}"




class RequestImage(Base):
    __tablename__ = "request_images"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=False)
    file_path = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    request = relationship("ServiceRequest", back_populates="images")

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("service_requests.id"), nullable=False)
    image_id = Column(Integer, ForeignKey("request_images.id"), nullable=True)
    
    # AI Identified details
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    quantity = Column(Integer, default=1)
    color = Column(String, nullable=True)
    bounding_box = Column(String, nullable=True) # Stored as "y1,x1,y2,x2" or generic string
    
    # Dimensions & Weight
    width_cm = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)
    depth_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    volume_m3 = Column(Float, nullable=True) # Pre-calculated volume
    
    request = relationship("ServiceRequest", back_populates="items")
