import anthropic
import base64
import json
from typing import Dict, List, Optional
from dataclasses import dataclass
from PIL import Image
import io

@dataclass
class BoatIdentificationResult:
    is_boat: bool
    make: Optional[str] = None
    model: Optional[str] = None
    description: Optional[str] = None
    year: Optional[str] = None
    length: Optional[str] = None
    boat_type: Optional[str] = None
    confidence: Optional[str] = None
    hull_material: Optional[str] = None
    features: Optional[List[str]] = None

class AnthropicBoatIdentifier:
    def __init__(self, api_key: str, model: str = "claude-3-sonnet-20240229"):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model
    
    def _prepare_image(self, image_data: bytes, max_size: tuple = (1024, 1024)) -> str:
        """Resize and encode image for API"""
        image = Image.open(io.BytesIO(image_data))
        
        # Resize if needed
        if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
            image.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Convert to base64
        buffer = io.BytesIO()
        image.save(buffer, format='JPEG', quality=85)
        return base64.b64encode(buffer.getvalue()).decode()
    
    def _build_prompt(self, requested_fields: List[str]) -> str:
        """Build structured prompt for boat identification"""
        field_descriptions = {
            'make': 'manufacturer/brand name',
            'model': 'specific model name',
            'description': 'detailed physical description',
            'year': 'estimated year or year range',
            'length': 'estimated length in feet',
            'boat_type': 'type (sailboat, motorboat, yacht, fishing boat, etc.)',
            'hull_material': 'hull material (fiberglass, wood, aluminum, etc.)',
            'features': 'notable features as an array'
        }
        
        requested_descriptions = [f'"{field}": {field_descriptions.get(field, field)}' 
                                for field in requested_fields]
        
        return f"""
        Analyze this image carefully and determine if it shows a boat or watercraft.
        
        If it IS a boat, respond with a JSON object containing:
        {{
            "is_boat": true,
            "confidence": "high|medium|low",
            {', '.join(requested_descriptions)}
        }}
        
        If it is NOT a boat, respond with:
        {{
            "is_boat": false,
            "confidence": "high",
            "description": "brief description of what you see instead"
        }}
        
        Guidelines:
        - Use "unknown" for fields you cannot determine
        - Be specific but concise
        - Confidence should reflect your certainty about the boat identification
        - For features, include notable equipment, design elements, or modifications
        
        Respond only with valid JSON.
        """
    
    async def identify_boat(self, 
                          image_data: bytes, 
                          requested_fields: List[str] = None) -> BoatIdentificationResult:
        """Identify boat from image data"""
        
        if requested_fields is None:
            requested_fields = ['make', 'model', 'description', 'boat_type']
        
        try:
            # Prepare image
            base64_image = self._prepare_image(image_data)
            
            # Build prompt
            prompt = self._build_prompt(requested_fields)
            
            # Call Anthropic API
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1000,
                temperature=0.1,  # Lower temperature for more consistent responses
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/jpeg",
                                    "data": base64_image
                                }
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ]
                    }
                ]
            )
            
            # Parse response
            result_text = response.content[0].text
            result_json = json.loads(result_text)
            
            # Convert to structured result
            return self._parse_result(result_json)
            
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse API response as JSON: {e}")
        except Exception as e:
            raise RuntimeError(f"Error calling Anthropic API: {e}")
    
    def _parse_result(self, result_json: Dict) -> BoatIdentificationResult:
        """Parse JSON response into structured result"""
        return BoatIdentificationResult(
            is_boat=result_json.get('is_boat', False),
            make=result_json.get('make'),
            model=result_json.get('model'),
            description=result_json.get('description'),
            year=result_json.get('year'),
            length=result_json.get('length'),
            boat_type=result_json.get('boat_type'),
            confidence=result_json.get('confidence'),
            hull_material=result_json.get('hull_material'),
            features=result_json.get('features', [])
        )