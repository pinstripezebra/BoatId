
import os
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from PIL import Image
import glob

# Load environment variables
load_dotenv()

# Initialize S3 client
s3 = boto3.client('s3')

# Get AWS configuration from environment variables
aws_bucket_name = os.getenv("AWS_BUCKET_NAME")
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def upload_images_to_s3():
    """Upload all images from data/images directory to S3 as PNG files"""
    image_urls = {}
    images_path = os.path.join(project_root, 'data', 'images')
    
    # Validate AWS bucket name
    if not aws_bucket_name:
        print("ERROR: AWS_BUCKET_NAME environment variable is not configured. Skipping S3 upload.")
        return image_urls
    
    # Check if images directory exists
    if not os.path.exists(images_path):
        print(f"ERROR: Images directory not found at {images_path}")
        return image_urls
    
    # Find all image files in the directory
    image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.gif', '*.bmp', '*.webp', '*.tiff']
    image_files = []
    
    for extension in image_extensions:
        image_files.extend(glob.glob(os.path.join(images_path, extension)))
        image_files.extend(glob.glob(os.path.join(images_path, extension.upper())))
    
    if not image_files:
        print(f"No image files found in {images_path}")
        return image_urls
    
    print(f"Found {len(image_files)} image files to upload...")
    
    for local_file_path in image_files:
        try:
            # Get filename without extension
            filename = os.path.basename(local_file_path)
            name_without_ext = os.path.splitext(filename)[0]
            
            # S3 key (filename in bucket) - always save as PNG
            s3_key = f"boat-images/{name_without_ext}.png"
            
            print(f"Processing {filename}...")
            
            # Convert image to PNG format
            with Image.open(local_file_path) as img:
                # Convert to RGB if necessary (for PNG compatibility)
                if img.mode in ('RGBA', 'LA', 'P'):
                    # Keep transparency for RGBA, convert others to RGB
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                elif img.mode not in ('RGB', 'RGBA'):
                    img = img.convert('RGB')
                
                # Save as PNG to temporary location
                temp_png_path = local_file_path + '.temp.png'
                img.save(temp_png_path, 'PNG')
            
            # Upload PNG to S3
            s3.upload_file(
                temp_png_path, 
                aws_bucket_name, 
                s3_key,
                ExtraArgs={'ContentType': 'image/png'}
            )
            
            # Generate S3 URL
            s3_url = f"https://{aws_bucket_name}.s3.amazonaws.com/{s3_key}"
            image_urls[name_without_ext] = s3_url
            
            print(f"✓ Uploaded {filename} as PNG to S3: {s3_url}")
            
            # Clean up temporary PNG file
            os.remove(temp_png_path)
            
        except ClientError as e:
            print(f"AWS Client Error uploading {filename}: {e}")
        except Exception as e:
            print(f"Unexpected error uploading {filename}: {e}")
            print(f"Error type: {type(e).__name__}")
    
    print(f"\n🎉 Successfully uploaded {len(image_urls)} images to S3!")
    return image_urls

if __name__ == "__main__":
    # Run the upload when script is executed directly
    print("Starting S3 image upload...")
    uploaded_images = upload_images_to_s3()
    
    if uploaded_images:
        print(f"\nUploaded images:")
        for name, url in uploaded_images.items():
            print(f"  {name}: {url}")
    else:
        print("No images were uploaded.")