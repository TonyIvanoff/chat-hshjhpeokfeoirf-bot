import asyncio
import httpx

BASE_URL = "http://localhost:8000"
EMAIL = "test@example.com"
PASSWORD = "password123"

async def test_auth_flow():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # 1. Register
        print("Testing Registration...")
        response = await client.post("/auth/register", json={
            "email": EMAIL,
            "password": PASSWORD,
            "full_name": "Test User"
        })
        if response.status_code == 400 and "already exists" in response.text:
             print("User already exists, proceeding to login.")
        else:
            print(f"Registration Status: {response.status_code}")
            print(f"Registration Response: {response.json()}")
            assert response.status_code == 200

        # 2. Login
        print("\nTesting Login...")
        response = await client.post("/auth/token", data={
            "username": EMAIL,
            "password": PASSWORD
        })
        print(f"Login Status: {response.status_code}")
        assert response.status_code == 200
        token_data = response.json()
        assert "access_token" in token_data
        print("Login Successful, Token received.")

if __name__ == "__main__":
    asyncio.run(test_auth_flow())
