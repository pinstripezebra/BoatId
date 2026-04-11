#!/usr/bin/env python3
"""
Backend storage configuration test script
"""

import os
import boto3
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from botocore.exceptions import ClientError, NoCredentialsError

load_dotenv()

def test_environment_variables():
    """Test that all required environment variables are set"""
    print("🔍 Checking environment variables...")
    
    required_vars = [
        'AWS_BUCKET_NAME',
        'ANTHROPIC_API_KEY',
        'AWS_RDS_ENDPOINT',
        'AWS_RDS_DATABASE',
        'AWS_RDS_MASTER_USERNAME', 
        'AWS_RDS_PASSWORD'
    ]
    
    missing = []
    for var in required_vars:
        if not os.getenv(var):
            missing.append(var)
        else:
            if 'PASSWORD' in var or 'KEY' in var:
                print(f"✅ {var}: ***hidden***")
            else:
                print(f"✅ {var}: {os.getenv(var)}")
    
    if missing:
        print(f"\n❌ Missing environment variables: {', '.join(missing)}")
        return False
    
    print("✅ All environment variables are set")
    return True

def test_s3_connection():
    """Test S3 bucket access"""
    print("\n🪣 Testing S3 connection...")
    
    try:
        s3_client = boto3.client('s3')
        bucket_name = os.getenv('AWS_BUCKET_NAME')
        
        if not bucket_name:
            print("❌ AWS_BUCKET_NAME not set")
            return False
        
        # Test bucket access
        s3_client.head_bucket(Bucket=bucket_name)
        print(f"✅ S3 bucket '{bucket_name}' is accessible")
        
        # Test upload permissions by creating a small test file
        test_key = "test/connection-test.txt"
        s3_client.put_object(
            Bucket=bucket_name,
            Key=test_key,
            Body=b"Connection test",
            ContentType="text/plain"
        )
        print("✅ S3 upload permissions working")
        
        # Clean up test file
        s3_client.delete_object(Bucket=bucket_name, Key=test_key)
        print("✅ S3 delete permissions working")
        
        return True
        
    except NoCredentialsError:
        print("❌ AWS credentials not found")
        print("💡 Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY")
        return False
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchBucket':
            print(f"❌ S3 bucket '{bucket_name}' does not exist")
        elif error_code == 'AccessDenied':
            print(f"❌ Access denied to S3 bucket '{bucket_name}'")
        else:
            print(f"❌ S3 error: {e}")
        return False
    except Exception as e:
        print(f"❌ S3 connection error: {e}")
        return False

def test_database_connection():
    """Test RDS database connection"""
    print("\n🗄️ Testing database connection...")
    
    try:
        # Build connection URL
        username = os.getenv('AWS_RDS_MASTER_USERNAME')
        password = os.getenv('AWS_RDS_PASSWORD')
        endpoint = os.getenv('AWS_RDS_ENDPOINT')
        port = os.getenv('AWS_RDS_PORT', '5432')
        database = os.getenv('AWS_RDS_DATABASE')
        
        url = f"postgresql://{username}:{password}@{endpoint}:{port}/{database}"
        
        engine = create_engine(url)
        
        with engine.connect() as connection:
            # Test basic connection
            result = connection.execute(text("SELECT 1"))
            print("✅ Database connection successful")
            
            # Check if car_identifications table exists
            table_check = connection.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'car_identifications'
                )
            """))
            
            if table_check.fetchone()[0]:
                print("✅ car_identifications table exists")
                
                # Check table structure
                column_check = connection.execute(text("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'car_identifications'
                    ORDER BY ordinal_position
                """))
                
                columns = column_check.fetchall()
                print(f"✅ Table has {len(columns)} columns")
                
            else:
                print("⚠️ car_identifications table does not exist")
                print("💡 Run: python initialize_database.py")
        
        return True
        
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return False

def main():
    """Run all storage tests"""
    print("🧪 Testing Backend Storage Configuration\n")
    
    tests = [
        test_environment_variables,
        test_s3_connection, 
        test_database_connection
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
    
    print(f"\n📊 Storage Tests: {passed}/{total} passed")
    
    if passed == total:
        print("🎉 All storage tests passed! Your backend is ready.")
        print("\n📋 Next steps:")
        print("   1. Start your FastAPI server")
        print("   2. Test the camera → API → storage flow")
    else:
        print("⚠️ Some tests failed. Fix the issues above before proceeding.")
    
    return passed == total

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)