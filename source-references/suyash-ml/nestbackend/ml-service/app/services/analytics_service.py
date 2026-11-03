from typing import List
from collections import defaultdict
import numpy as np

from app.models.schemas import MatchResult, AnalyticsResponse

class AnalyticsService:
    @staticmethod
    def generate_analytics(match_results: List[MatchResult]) -> AnalyticsResponse:
        if not match_results:
            return AnalyticsResponse(
                total_students=0,
                total_internships=0,
                avg_matches_per_student=0.0,
                avg_match_score=0.0,
                diversity_distribution={},
                sector_distribution={},
                location_distribution={}
            )
        
        total_students = len(match_results)
        total_matches = sum(len(r.matches) for r in match_results)
        
        all_internship_ids = set()
        all_scores = []
        
        for result in match_results:
            for match in result.matches:
                all_internship_ids.add(match.internship_id)
                all_scores.append(match.overall_score)
        
        avg_matches = total_matches / total_students if total_students > 0 else 0
        avg_score = np.mean(all_scores) if all_scores else 0.0
        
        diversity_dist = defaultdict(int)
        sector_dist = defaultdict(int)
        location_dist = defaultdict(int)
        
        for result in match_results:
            for match in result.matches:
                if 'diversity' in match.explanation:
                    div_factors = match.explanation['diversity'].split(', ')
                    for factor in div_factors:
                        if factor != "No diversity factors":
                            diversity_dist[factor] += 1
                
                if 'sector' in match.explanation:
                    sector_dist[match.explanation['sector']] += 1
                
                if 'location' in match.explanation:
                    location_dist[match.explanation['location']] += 1
        
        return AnalyticsResponse(
            total_students=total_students,
            total_internships=len(all_internship_ids),
            avg_matches_per_student=round(avg_matches, 2),
            avg_match_score=round(float(avg_score), 4),
            diversity_distribution=dict(diversity_dist),
            sector_distribution=dict(sector_dist),
            location_distribution=dict(location_dist)
        )
