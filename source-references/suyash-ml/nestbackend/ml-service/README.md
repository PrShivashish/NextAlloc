# PM Internship Matching ML Service

Production-grade AI/ML service for intelligent internship matching using FastAPI and machine learning.

## Features

- **Semantic Skill Matching**: Uses sentence transformers for deep skill similarity analysis
- **Multi-Factor Scoring**: Considers skills, qualifications, location, sector, and diversity
- **Affirmative Action Support**: Boosts candidates from rural/aspirational districts and underrepresented categories
- **Batch Processing**: Efficiently processes thousands of matches
- **Optimization Engine**: Maximizes overall allocation quality
- **RESTful API**: FastAPI-based endpoints with automatic documentation
- **Production Ready**: Includes Docker, logging, monitoring, and error handling

## Architecture

### Matching Algorithm

The matching engine uses a weighted scoring system:

1. **Skill Score (35%)**: 
   - Semantic similarity using sentence transformers
   - Direct skill overlap ratio
   
2. **Qualification Score (25%)**:
   - Education level matching
   - CGPA requirements
   
3. **Location Score (15%)**:
   - Preference matching
   - Partial matches supported
   
4. **Sector Score (15%)**:
   - Interest alignment
   - Industry matching
   
5. **Diversity Score (10%)**:
   - Social category representation
   - Rural/aspirational district boost
   - First-time applicant priority

### ML Models

- **Sentence Transformer**: `all-MiniLM-L6-v2` for skill embeddings
- **Cosine Similarity**: For semantic matching
- **StandardScaler**: For feature normalization

## Installation

### Local Development

```bash
cd ml-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Environment Setup

```bash
cp .env.example .env
# Edit .env with your configuration
```

### Run the Service

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Docker

```bash
docker build -t pm-internship-ml-service .
docker run -p 8000:8000 --env-file .env pm-internship-ml-service
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Key Endpoints

#### 1. Batch Matching
```http
POST /api/v1/matching/batch
```

Match multiple students with multiple internships.

**Request Body:**
```json
{
  "students": [...],
  "internships": [...],
  "diversity_boost": true,
  "max_matches_per_student": 10,
  "min_score_threshold": 0.5
}
```

#### 2. Single Student Match
```http
POST /api/v1/matching/single
```

Match a single student with available internships.

#### 3. Optimize Allocation
```http
POST /api/v1/matching/optimize
```

Find optimal student-internship allocation considering capacity constraints.

#### 4. Analytics
```http
POST /api/v1/analytics/generate
```

Generate insights from matching results.

## Usage Example

```python
import httpx

# Prepare data
request_data = {
    "students": [
        {
            "student_id": "S001",
            "name": "Rahul Kumar",
            "skills": ["Python", "Machine Learning", "Data Analysis"],
            "qualification": "UNDERGRADUATE",
            "field_of_study": "Computer Science",
            "cgpa": 8.5,
            "location_preference": ["Delhi", "Mumbai"],
            "sector_interests": ["Technology", "AI"],
            "social_category": "OBC",
            "district_type": "RURAL",
            "past_internships": 0
        }
    ],
    "internships": [
        {
            "internship_id": "I001",
            "company_name": "Tech Corp",
            "title": "ML Intern",
            "description": "Work on ML projects",
            "required_skills": ["Python", "Machine Learning"],
            "preferred_qualification": "UNDERGRADUATE",
            "sector": "Technology",
            "location": "Delhi",
            "duration_months": 6,
            "capacity": 5,
            "filled_positions": 0,
            "min_cgpa": 7.0
        }
    ],
    "diversity_boost": true,
    "max_matches_per_student": 10,
    "min_score_threshold": 0.5
}

# Make request
async with httpx.AsyncClient() as client:
    response = await client.post(
        "http://localhost:8000/api/v1/matching/batch",
        json=request_data,
        headers={"X-API-Key": "your-secret-api-key-here"}
    )
    result = response.json()
    print(result)
```

## Configuration

Key environment variables:

- `ML_SERVICE_HOST`: Service host (default: 0.0.0.0)
- `ML_SERVICE_PORT`: Service port (default: 8000)
- `API_KEY`: API authentication key
- `SKILL_WEIGHT`: Weight for skill matching (default: 0.35)
- `QUALIFICATION_WEIGHT`: Weight for qualification (default: 0.25)
- `LOCATION_WEIGHT`: Weight for location (default: 0.15)
- `SECTOR_WEIGHT`: Weight for sector (default: 0.15)
- `DIVERSITY_WEIGHT`: Weight for diversity (default: 0.10)

## Performance

- Processes ~1000 student-internship pairs per second
- Model loading: ~2-3 seconds on startup
- Average match latency: <100ms per student

## Testing

```bash
pytest tests/ -v
```

## Monitoring

The service exposes metrics at `/metrics` for Prometheus integration.

## License

MIT
