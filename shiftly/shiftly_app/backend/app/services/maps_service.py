import random
from typing import Tuple

class MapsService:
    @staticmethod
    def calculate_route(origin: str, destination: str) -> Tuple[float, float]:
        """
        Placeholder for Google Maps API.
        Returns:
            Tuple[float, float]: (distance_km, estimated_price_eur)
        
        Logic:
        - Real implementation would query Google Maps Distance Matrix API.
        - Price calc: fixed base + per km rate.
        """
        # Simulate API call latency
        
        # Mock distance between 5 and 500 km
        distance_km = round(random.uniform(5, 500), 1)
        
        # Simple pricing logic: Base 50€ + 1.5€/km
        base_price = 50.0
        price_per_km = 1.5
        estimated_price = round(base_price + (distance_km * price_per_km), 2)
        
        return distance_km, estimated_price

maps_service = MapsService()
