from typing import List, Optional, Union
from datetime import datetime
from pydantic import BaseModel, field_validator, computed_field
import json

from app.schemas.user import UserOut

# Item Schemas
class ItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    bounding_box: Optional[Union[List[List[float]], str]] = None 

    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    depth_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    volume_m3: Optional[float] = None
    quantity: int = 1

class ItemCreate(ItemBase):
    image_id: Optional[int] = None

class ItemOut(ItemBase):
    id: int
    image_id: Optional[int] = None

    @field_validator('bounding_box', mode='before')
    def parse_bounding_box(cls, v):
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                # Normalize plain list [1,2,3,4] to [[1,2,3,4]]
                if isinstance(parsed, list) and len(parsed) > 0 and isinstance(parsed[0], (int, float)):
                     return [parsed]
                return parsed
            except json.JSONDecodeError:
                return None
        return v

    class Config:
        from_attributes = True

# Request Image Schemas
class RequestImageOut(BaseModel):
    id: int
    file_path: str
    uploaded_at: datetime

    class Config:
        from_attributes = True

# Service Request Schemas
class ServiceRequestBase(BaseModel):
    pickup_address: str
    delivery_address: str

class ServiceRequestCreate(ServiceRequestBase):
    pass

class ServiceRequestOut(ServiceRequestBase):
    id: int
    @computed_field
    def display_id(self) -> str:
        return f"shift-{self.id}"
    user_id: str
    user: Optional[UserOut] = None
    status: str
    created_at: datetime
    items: List[ItemOut] = []
    images: List[RequestImageOut] = []
    distance_km: Optional[float] = None
    estimated_price: Optional[float] = None

    @field_validator('display_id', mode='before')
    def compute_display_id(cls, v, info):
        # We can compute this from the id if available, but pydantic v2 validaton is tricky with computed fields 
        # unless using @computed_field which is v2. 
        # Let's try @model_validator or just property method if pydantic v2 supports serialization of properties.
        # Simpler: The backend logic can just inject it. Or wait, from_attributes=True might not key off property.
        # Let's use @field_validator fallback? No, 'id' is available.
        pass
    
    @property
    def formatted_id(self):
        return f"boltt-{self.id}"

    class Config:
        from_attributes = True


    # Pydantic V2 computed_field is best if available, but let's stick to basics. 
    # API endpoint returns ORM object. Pydantic converts ORM -> Dict.
    # If we add a property to the ORM model, Pydantic will read it.
    # Let's add property to ORM model instead!
