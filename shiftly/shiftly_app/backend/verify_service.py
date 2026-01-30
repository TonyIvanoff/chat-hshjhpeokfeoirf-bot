import asyncio
import httpx
import os

BASE_URL = "http://localhost:8000"
EMAIL = "client@example.com"
PASSWORD = "password123"

# Create a dummy image for testing
with open("test_image.jpg", "wb") as f:
    f.write(os.urandom(1024))

async def test_service_flow():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # 1. Register & Login
        print("Registering...")
        response = await client.post("/auth/register", json={
            "email": EMAIL,
            "password": PASSWORD,
            "full_name": "Client User"
        })
        if response.status_code == 400 and "already exists" in response.text:
            print("User already exists, logging in...")
        else:
            print(f"Registration Status: {response.status_code}")
            response.raise_for_status()
        
        print("Logging in...")
        response = await client.post("/auth/token", data={
            "username": EMAIL,
            "password": PASSWORD
        })
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Create Service Request
        print("Creating Service Request...")
        req_data = {
            "pickup_address": "123 Start St, City A",
            "delivery_address": "456 End St, City B"
        }
        response = await client.post("/requests/", json=req_data, headers=headers)
        if response.status_code != 200:
            print(f"Error Creating Request: {response.status_code}")
            print(response.text)
        assert response.status_code == 200
        request_data = response.json()
        request_id = request_data["id"]
        print(f"Request Created: ID {request_id}")
        
        # Verify Maps Integration
        dist = request_data.get("distance_km")
        price = request_data.get("estimated_price")
        print(f"Route: {dist} km, Est. Price: €{price}")
        
        # 3. Upload Image
        print("Uploading Image...")
        # We need a real image for TF to detect (even if just noise, it won't crash)
        # But a real object would be better. For now, random noise might not detect anything
        # but the pipeline should run.
        import numpy as np
        from PIL import Image
        
        # Create a dummy image that looks like something? 
        # No, just noise. The Fallback "Unidentified Item" will trigger.
        arr = np.random.randint(0, 255, (300, 300, 3), dtype=np.uint8)
        img = Image.fromarray(arr)
        img.save("test_image.jpg")

        with open("test_image.jpg", "rb") as f:
            files = {"file": ("test_image.jpg", f, "image/jpeg")}
            response = await client.post(f"/requests/{request_id}/images", files=files, headers=headers)
        
        print(f"Upload Status: {response.status_code}")
        if response.status_code != 200:
            print(response.text)
        assert response.status_code == 200
        
        data = response.json()
        print("Updated Request Data:")
        print(f"Items: {len(data['items'])}")
        if data['items']:
            item = data['items'][0]
            print(f"AI Identified Item: {item['name']} (Vol: {item['volume_m3']:.4f} m3)")

        # Cleanup
        if os.path.exists("test_image.jpg"):
            os.remove("test_image.jpg")

if __name__ == "__main__":
    asyncio.run(test_service_flow())
