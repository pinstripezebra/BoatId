import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_admin_token():
    """Get admin authentication token for development/testing."""
    
    # Get admin credentials from environment
    admin_username = os.getenv('ADMIN_USERNAME')
    admin_password = os.getenv('ADMIN_PASSWORD')
    
    # API endpoint
    base_url = "http://127.0.0.1:8000"
    login_url = f"{base_url}/auth/login"
    
    # Login payload
    payload = {
        "username": admin_username,
        "password": admin_password
    }
    
    try:
        # Make login request
        print(f"🔐 Authenticating as {admin_username}...")
        response = requests.post(login_url, json=payload)
        
        if response.status_code == 200:
            data = response.json()
            access_token = data.get('access_token')
            
            print("✅ Authentication successful!")
            print(f"🎫 Access Token: {access_token}")
            print(f"👤 User ID: {data.get('user_id')}")
            print(f"🏷️  Role: {data.get('role')}")
            print("\n" + "="*50)
            print("📋 FOR SWAGGER AUTHORIZATION:")
            print(f"{access_token}")
            print("="*50)
            print("\n📋 For curl requests, use full header:")
            print(f'Authorization: Bearer {access_token}')
            
            return access_token
            
        else:
            print(f"❌ Authentication failed: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Make sure the API is running on http://127.0.0.1:8000")
        return None
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None

if __name__ == "__main__":
    token = get_admin_token()
    if token:
        # Save token only to clipboard for easy Swagger pasting
        try:
            import pyperclip
            pyperclip.copy(token)
            print("📋 Token (without 'Bearer') copied to clipboard for Swagger!")
        except ImportError:
            print("💡 Tip: Install pyperclip (pip install pyperclip) to auto-copy to clipboard")