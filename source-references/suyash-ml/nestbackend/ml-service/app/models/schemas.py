from pydantic import BaseModel, ConfigDict, Field, validator
from typing import List, Optional, Dict
from enum import Enum

class SocialCategory(str, Enum):
    GENERAL = "GENERAL"
    OBC = "OBC"
    SC = "SC"
    ST = "ST"
    EWS = "EWS"

class DistrictType(str, Enum):
    URBAN = "URBAN"
    RURAL = "RURAL"
    ASPIRATIONAL = "ASPIRATIONAL"

class QualificationLevel(str, Enum):
    DIPLOMA = "DIPLOMA"
    UNDERGRADUATE = "UNDERGRADUATE"
    POSTGRADUATE = "POSTGRADUATE"
    DOCTORATE = "DOCTORATE"

class StudentProfile(BaseModel):
    student_id: str
    name: str
    skills: List[str] = Field(..., min_items=1)
    qualification: QualificationLevel
    field_of_study: str
    cgpa: float = Field(..., ge=0.0, le=10.0)
    location_preference: List[str] = Field(..., min_items=1)
    sector_interests: List[str] = Field(..., min_items=1)
    social_category: SocialCategory
    district_type: DistrictType
    past_internships: int = Field(default=0, ge=0)
    languages: List[str] = []
    certifications: List[str] = []
    
    @validator('skills', 'location_preference', 'sector_interests')
    def validate_non_empty_strings(cls, v):
        if not all(item.strip() for item in v):
            raise ValueError("List items cannot be empty strings")
        return v

class InternshipOpportunity(BaseModel):
    internship_id: str
    company_name: str
    title: str
    description: str
    required_skills: List[str] = Field(..., min_items=1)
    preferred_qualification: QualificationLevel
    sector: str
    location: str
    stipend: Optional[float] = None
    duration_months: int = Field(..., ge=1, le=12)
    capacity: int = Field(..., ge=1)
    filled_positions: int = Field(default=0, ge=0)
    min_cgpa: float = Field(default=0.0, ge=0.0, le=10.0)
    preferred_fields: List[str] = []
    preferred_skills: List[str] = []
    required_languages: List[str] = []
    hard_min_cgpa: Optional[float] = None
    hard_min_qualification: Optional[QualificationLevel] = None

    @validator('filled_positions')
    def validate_filled_positions(cls, v, values):
        if 'capacity' in values and v > values['capacity']:
            raise ValueError("Filled positions cannot exceed capacity")
        return v

class MatchRequest(BaseModel):
    students: List[StudentProfile]
    internships: List[InternshipOpportunity]
    diversity_boost: bool = Field(default=True)
    max_matches_per_student: int = Field(default=10, ge=1, le=50)
    min_score_threshold: float = Field(default=0.5, ge=0.0, le=1.0)

class MatchScore(BaseModel):
    student_id: str
    internship_id: str
    overall_score: float
    skill_score: float
    qualification_score: float
    location_score: float
    sector_score: float
    diversity_score: float
    field_score: float = 0.0
    certification_score: float = 0.0
    language_score: float = 0.0
    ranker_score: Optional[float] = None
    eligible: bool = True
    explanation: Dict[str, str]

class MatchResult(BaseModel):
    student_id: str
    student_name: str
    matches: List[MatchScore]
    total_matches: int

class BatchMatchResponse(BaseModel):
    results: List[MatchResult]
    total_students_processed: int
    total_matches_generated: int
    processing_time_seconds: float

class SingleMatchRequest(BaseModel):
    student: StudentProfile
    internships: List[InternshipOpportunity]
    max_matches: int = Field(default=10, ge=1, le=50)

class RankRequest(BaseModel):
    student: StudentProfile
    internships: List[InternshipOpportunity]
    max_matches: int = Field(default=10, ge=1, le=50)
    min_score: float = Field(default=0.0, ge=0.0, le=1.0)
    candidate_pool_size: int = Field(default=100, ge=1, le=1000)
    apply_hard_filter: bool = True
    use_trained_ranker: bool = True
    diversity_boost: bool = True

class TrainRequest(BaseModel):
    n_samples: int = Field(default=5000, ge=100, le=100000)
    random_seed: int = Field(default=42)

class TrainResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    n_samples: int
    n_features: int
    train_accuracy: float
    val_accuracy: float
    val_roc_auc: float
    model_path: str
    feature_importances: Dict[str, float]

class AnalyticsRequest(BaseModel):
    match_results: List[MatchResult]

class AnalyticsResponse(BaseModel):
    total_students: int
    total_internships: int
    avg_matches_per_student: float
    avg_match_score: float
    diversity_distribution: Dict[str, int]
    sector_distribution: Dict[str, int]
    location_distribution: Dict[str, int]
