"""
User analytics data models and metrics

This module defines the data structures for user analytics,
including metrics calculation and data validation.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from enum import Enum
import json


class MetricType(Enum):
    """Enumeration of available analytics metric types"""
    SESSIONS = "sessions"
    PAGEVIEWS = "pageviews"
    DURATION = "avg_session_duration"
    CONVERSIONS = "conversions"
    BOUNCE_RATE = "bounce_rate"
    RETENTION = "retention_rate"


class TimeGranularity(Enum):
    """Time granularity options for analytics aggregation"""
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


@dataclass
class AnalyticsMetrics:
    """
    Container for user analytics metrics
    
    Stores various user engagement and behavior metrics
    with validation and calculation methods.
    
    Attributes:
        sessions (int): Total number of user sessions
        pageviews (int): Total page views across all sessions
        avg_session_duration (float): Average session duration in seconds
        conversions (int): Number of conversion events
        bounce_rate (float): Percentage of single-page sessions
        retention_rate (float): User retention rate as percentage
        
    Example:
        >>> metrics = AnalyticsMetrics(
        ...     sessions=25,
        ...     pageviews=150,
        ...     avg_session_duration=245.5
        ... )
        >>> metrics.calculate_engagement_score()
        0.75
    """
    sessions: int = 0
    pageviews: int = 0
    avg_session_duration: float = 0.0
    conversions: int = 0
    bounce_rate: float = 0.0
    retention_rate: float = 0.0
    
    def __post_init__(self):
        """Validate metrics after initialization"""
        self.validate()
    
    def validate(self) -> None:
        """
        Validate metric values are within expected ranges
        
        Raises:
            ValueError: If any metric value is invalid
        """
        if self.sessions < 0:
            raise ValueError("Sessions count cannot be negative")
        
        if self.pageviews < 0:
            raise ValueError("Pageviews count cannot be negative")
        
        if self.avg_session_duration < 0:
            raise ValueError("Average session duration cannot be negative")
        
        if not 0 <= self.bounce_rate <= 100:
            raise ValueError("Bounce rate must be between 0 and 100")
        
        if not 0 <= self.retention_rate <= 100:
            raise ValueError("Retention rate must be between 0 and 100")
    
    def calculate_engagement_score(self) -> float:
        """
        Calculate overall user engagement score
        
        Combines multiple metrics into a single engagement score
        ranging from 0.0 (low engagement) to 1.0 (high engagement).
        
        Returns:
            float: Engagement score between 0.0 and 1.0
            
        Example:
            >>> metrics = AnalyticsMetrics(sessions=20, pageviews=100, avg_session_duration=300)
            >>> score = metrics.calculate_engagement_score()
            >>> print(f"Engagement score: {score:.2f}")
            Engagement score: 0.68
        """
        if self.sessions == 0:
            return 0.0
        
        # Normalize metrics to 0-1 scale
        session_score = min(self.sessions / 50, 1.0)  # 50+ sessions = max score
        pageview_score = min((self.pageviews / self.sessions) / 10, 1.0)  # 10+ pages/session = max
        duration_score = min(self.avg_session_duration / 600, 1.0)  # 10+ minutes = max
        conversion_score = min(self.conversions / 5, 1.0)  # 5+ conversions = max
        
        # Weighted average
        weights = [0.3, 0.25, 0.25, 0.2]  # sessions, pageviews, duration, conversions
        scores = [session_score, pageview_score, duration_score, conversion_score]
        
        return sum(w * s for w, s in zip(weights, scores))
    
    def to_dict(self) -> Dict[str, Union[int, float]]:
        """
        Convert metrics to dictionary format
        
        Returns:
            dict: Metrics as key-value pairs
        """
        return {
            "sessions": self.sessions,
            "pageviews": self.pageviews,
            "avg_session_duration": self.avg_session_duration,
            "conversions": self.conversions,
            "bounce_rate": self.bounce_rate,
            "retention_rate": self.retention_rate,
            "engagement_score": self.calculate_engagement_score()
        }


@dataclass
class UserAnalytics:
    """
    Complete user analytics data structure
    
    Contains user identification, time period information,
    and comprehensive metrics for analytics reporting.
    
    Attributes:
        user_id (str): Unique identifier for the user
        period_start (datetime): Start of analytics period
        period_end (datetime): End of analytics period
        metrics (AnalyticsMetrics): User engagement metrics
        metadata (dict): Additional analytics metadata
        
    Example:
        >>> analytics = UserAnalytics(
        ...     user_id="user123",
        ...     period_start=datetime(2023, 6, 1),
        ...     period_end=datetime(2023, 6, 30),
        ...     metrics=AnalyticsMetrics(sessions=45, pageviews=230)
        ... )
        >>> analytics.get_period_days()
        29
    """
    user_id: str
    period_start: datetime
    period_end: datetime
    metrics: AnalyticsMetrics
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        """Validate analytics data after initialization"""
        if self.period_start >= self.period_end:
            raise ValueError("Period start must be before period end")
        
        if not self.user_id:
            raise ValueError("User ID cannot be empty")
    
    def get_period_days(self) -> int:
        """
        Calculate the number of days in the analytics period
        
        Returns:
            int: Number of days in the period
        """
        return (self.period_end - self.period_start).days
    
    def get_daily_averages(self) -> Dict[str, float]:
        """
        Calculate daily averages for all metrics
        
        Returns:
            dict: Daily average values for each metric
            
        Example:
            >>> analytics = UserAnalytics(...)
            >>> averages = analytics.get_daily_averages()
            >>> print(f"Daily sessions: {averages['sessions_per_day']:.1f}")
            Daily sessions: 1.5
        """
        days = max(self.get_period_days(), 1)  # Avoid division by zero
        
        return {
            "sessions_per_day": self.metrics.sessions / days,
            "pageviews_per_day": self.metrics.pageviews / days,
            "conversions_per_day": self.metrics.conversions / days
        }
    
    def compare_to_baseline(self, baseline: 'UserAnalytics') -> Dict[str, float]:
        """
        Compare current analytics to a baseline period
        
        Args:
            baseline (UserAnalytics): Baseline analytics for comparison
            
        Returns:
            dict: Percentage changes from baseline
            
        Example:
            >>> current = UserAnalytics(...)
            >>> previous = UserAnalytics(...)
            >>> changes = current.compare_to_baseline(previous)
            >>> print(f"Sessions changed by {changes['sessions']:.1f}%")
            Sessions changed by 15.3%
        """
        if baseline.user_id != self.user_id:
            raise ValueError("Cannot compare analytics for different users")
        
        def calculate_change(current: float, baseline_val: float) -> float:
            if baseline_val == 0:
                return 100.0 if current > 0 else 0.0
            return ((current - baseline_val) / baseline_val) * 100
        
        return {
            "sessions": calculate_change(self.metrics.sessions, baseline.metrics.sessions),
            "pageviews": calculate_change(self.metrics.pageviews, baseline.metrics.pageviews),
            "avg_session_duration": calculate_change(
                self.metrics.avg_session_duration, 
                baseline.metrics.avg_session_duration
            ),
            "conversions": calculate_change(self.metrics.conversions, baseline.metrics.conversions),
            "engagement_score": calculate_change(
                self.metrics.calculate_engagement_score(),
                baseline.metrics.calculate_engagement_score()
            )
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Convert analytics to dictionary format for JSON serialization
        
        Returns:
            dict: Complete analytics data as dictionary
        """
        return {
            "user_id": self.user_id,
            "period": {
                "start": self.period_start.isoformat(),
                "end": self.period_end.isoformat(),
                "days": self.get_period_days()
            },
            "metrics": self.metrics.to_dict(),
            "daily_averages": self.get_daily_averages(),
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'UserAnalytics':
        """
        Create UserAnalytics instance from dictionary data
        
        Args:
            data (dict): Analytics data dictionary
            
        Returns:
            UserAnalytics: New analytics instance
            
        Example:
            >>> data = {"user_id": "123", "period": {...}, "metrics": {...}}
            >>> analytics = UserAnalytics.from_dict(data)
        """
        metrics_data = data.get("metrics", {})
        metrics = AnalyticsMetrics(
            sessions=metrics_data.get("sessions", 0),
            pageviews=metrics_data.get("pageviews", 0),
            avg_session_duration=metrics_data.get("avg_session_duration", 0.0),
            conversions=metrics_data.get("conversions", 0),
            bounce_rate=metrics_data.get("bounce_rate", 0.0),
            retention_rate=metrics_data.get("retention_rate", 0.0)
        )
        
        period = data.get("period", {})
        
        return cls(
            user_id=data["user_id"],
            period_start=datetime.fromisoformat(period["start"]),
            period_end=datetime.fromisoformat(period["end"]),
            metrics=metrics,
            metadata=data.get("metadata", {})
        )


@dataclass
class AggregateAnalytics:
    """
    Aggregated analytics across multiple users or time periods
    
    Provides summary statistics and trend analysis for groups
    of users or extended time ranges.
    
    Attributes:
        total_users (int): Number of users included in aggregation
        period_start (datetime): Start of aggregation period
        period_end (datetime): End of aggregation period
        aggregate_metrics (AnalyticsMetrics): Combined metrics
        user_breakdown (List[UserAnalytics]): Individual user analytics
        trends (Dict[str, List[float]]): Trend data over time
    """
    total_users: int
    period_start: datetime
    period_end: datetime
    aggregate_metrics: AnalyticsMetrics
    user_breakdown: List[UserAnalytics] = field(default_factory=list)
    trends: Dict[str, List[float]] = field(default_factory=dict)
    
    def calculate_percentiles(self, metric: str) -> Dict[str, float]:
        """
        Calculate percentile distribution for a specific metric
        
        Args:
            metric (str): Name of the metric to analyze
            
        Returns:
            dict: Percentile values (25th, 50th, 75th, 95th)
        """
        if not self.user_breakdown:
            return {"p25": 0, "p50": 0, "p75": 0, "p95": 0}
        
        values = []
        for user_analytics in self.user_breakdown:
            if hasattr(user_analytics.metrics, metric):
                values.append(getattr(user_analytics.metrics, metric))
        
        if not values:
            return {"p25": 0, "p50": 0, "p75": 0, "p95": 0}
        
        values.sort()
        n = len(values)
        
        return {
            "p25": values[int(n * 0.25)],
            "p50": values[int(n * 0.50)],
            "p75": values[int(n * 0.75)],
            "p95": values[int(n * 0.95)]
        }
    
    def get_top_users(self, metric: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get top users by a specific metric
        
        Args:
            metric (str): Metric to rank by
            limit (int): Maximum number of users to return
            
        Returns:
            list: Top users with their metric values
        """
        user_scores = []
        
        for user_analytics in self.user_breakdown:
            if hasattr(user_analytics.metrics, metric):
                score = getattr(user_analytics.metrics, metric)
                user_scores.append({
                    "user_id": user_analytics.user_id,
                    "value": score,
                    "metric": metric
                })
        
        # Sort by metric value (descending) and return top N
        user_scores.sort(key=lambda x: x["value"], reverse=True)
        return user_scores[:limit]