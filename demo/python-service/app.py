"""
Flask microservice for data processing and analytics

This service provides data processing capabilities including
user analytics, report generation, and machine learning features.
Demonstrates Python documentation generation capabilities.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Import service modules
from services.analytics_service import AnalyticsService
from services.report_service import ReportService
from models.user_analytics import UserAnalytics, AnalyticsMetrics
from utils.data_processor import DataProcessor

# Initialize services
analytics_service = AnalyticsService()
report_service = ReportService()
data_processor = DataProcessor()


@app.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint for service monitoring
    
    Returns:
        dict: Service health status and metadata
        
    Example:
        GET /health
        {
            "status": "healthy",
            "timestamp": "2023-06-15T10:30:00Z",
            "version": "1.0.0"
        }
    """
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "version": "1.0.0",
        "service": "python-analytics-service"
    })


@app.route('/analytics/users/<user_id>', methods=['GET'])
def get_user_analytics(user_id: str):
    """
    Retrieve analytics data for a specific user
    
    Args:
        user_id (str): Unique identifier for the user
        
    Query Parameters:
        days (int): Number of days to include in analytics (default: 30)
        metrics (str): Comma-separated list of metrics to include
        
    Returns:
        dict: User analytics data including activity metrics and trends
        
    Raises:
        404: If user not found
        400: If invalid parameters provided
        
    Example:
        GET /analytics/users/123?days=7&metrics=sessions,pageviews
        {
            "user_id": "123",
            "period": {
                "start": "2023-06-08T00:00:00Z",
                "end": "2023-06-15T00:00:00Z",
                "days": 7
            },
            "metrics": {
                "sessions": 15,
                "pageviews": 142,
                "avg_session_duration": 285.5
            }
        }
    """
    try:
        # Parse query parameters
        days = int(request.args.get('days', 30))
        metrics_param = request.args.get('metrics', '')
        requested_metrics = [m.strip() for m in metrics_param.split(',') if m.strip()]
        
        # Validate parameters
        if days < 1 or days > 365:
            return jsonify({
                "error": "Invalid days parameter. Must be between 1 and 365."
            }), 400
        
        # Get analytics data
        analytics_data = analytics_service.get_user_analytics(
            user_id=user_id,
            days=days,
            metrics=requested_metrics
        )
        
        if not analytics_data:
            return jsonify({
                "error": f"User {user_id} not found or no analytics data available"
            }), 404
        
        return jsonify(analytics_data)
        
    except ValueError as e:
        logger.error(f"Invalid parameter in user analytics request: {e}")
        return jsonify({"error": "Invalid parameter format"}), 400
    except Exception as e:
        logger.error(f"Error retrieving user analytics: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route('/analytics/aggregate', methods=['POST'])
def generate_aggregate_analytics():
    """
    Generate aggregate analytics across multiple users or time periods
    
    Request Body:
        user_ids (List[str]): List of user IDs to include
        date_range (dict): Start and end dates for analysis
        group_by (str): Grouping dimension (day, week, month)
        metrics (List[str]): Metrics to calculate
        
    Returns:
        dict: Aggregated analytics data with breakdowns and trends
        
    Example:
        POST /analytics/aggregate
        {
            "user_ids": ["123", "456", "789"],
            "date_range": {
                "start": "2023-06-01",
                "end": "2023-06-15"
            },
            "group_by": "day",
            "metrics": ["sessions", "pageviews", "conversions"]
        }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        # Validate required fields
        required_fields = ['user_ids', 'date_range', 'metrics']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Process aggregate analytics
        result = analytics_service.generate_aggregate_analytics(
            user_ids=data['user_ids'],
            date_range=data['date_range'],
            group_by=data.get('group_by', 'day'),
            metrics=data['metrics']
        )
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error generating aggregate analytics: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route('/reports/generate', methods=['POST'])
def generate_report():
    """
    Generate a custom analytics report
    
    Supports various report types including user activity reports,
    performance summaries, and trend analysis documents.
    
    Request Body:
        report_type (str): Type of report to generate
        parameters (dict): Report-specific parameters
        format (str): Output format (json, pdf, csv)
        
    Returns:
        dict: Generated report data or download link
        
    Example:
        POST /reports/generate
        {
            "report_type": "user_activity",
            "parameters": {
                "date_range": "last_30_days",
                "include_charts": true
            },
            "format": "json"
        }
    """
    try:
        data = request.get_json()
        
        if not data or 'report_type' not in data:
            return jsonify({"error": "report_type is required"}), 400
        
        report_type = data['report_type']
        parameters = data.get('parameters', {})
        output_format = data.get('format', 'json')
        
        # Generate report
        report = report_service.generate_report(
            report_type=report_type,
            parameters=parameters,
            output_format=output_format
        )
        
        return jsonify({
            "success": True,
            "report": report,
            "generated_at": datetime.utcnow().isoformat() + "Z"
        })
        
    except ValueError as e:
        logger.error(f"Invalid report parameters: {e}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error generating report: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route('/data/process', methods=['POST'])
def process_data():
    """
    Process raw data through various transformation pipelines
    
    Accepts raw data and applies processing functions such as
    cleaning, normalization, aggregation, and feature extraction.
    
    Request Body:
        data (Any): Raw data to process
        pipeline (List[str]): Processing steps to apply
        options (dict): Processing options and parameters
        
    Returns:
        dict: Processed data and processing metadata
        
    Example:
        POST /data/process
        {
            "data": [{"user_id": "123", "event": "click", "timestamp": "2023-06-15T10:30:00Z"}],
            "pipeline": ["clean", "normalize", "aggregate"],
            "options": {
                "time_window": "1h",
                "group_by": "user_id"
            }
        }
    """
    try:
        request_data = request.get_json()
        
        if not request_data or 'data' not in request_data:
            return jsonify({"error": "data field is required"}), 400
        
        raw_data = request_data['data']
        pipeline = request_data.get('pipeline', ['clean'])
        options = request_data.get('options', {})
        
        # Process data through pipeline
        processed_data = data_processor.process_pipeline(
            data=raw_data,
            pipeline=pipeline,
            options=options
        )
        
        return jsonify({
            "success": True,
            "processed_data": processed_data,
            "pipeline_applied": pipeline,
            "processing_time": data_processor.get_last_processing_time(),
            "records_processed": len(processed_data) if isinstance(processed_data, list) else 1
        })
        
    except Exception as e:
        logger.error(f"Error processing data: {e}")
        return jsonify({"error": "Data processing failed"}), 500


@app.route('/ml/predict', methods=['POST'])
def make_prediction():
    """
    Make predictions using trained machine learning models
    
    Supports various prediction types including user behavior prediction,
    churn analysis, and recommendation generation.
    
    Request Body:
        model_name (str): Name of the model to use
        features (dict): Input features for prediction
        options (dict): Prediction options
        
    Returns:
        dict: Prediction results with confidence scores
        
    Example:
        POST /ml/predict
        {
            "model_name": "churn_prediction",
            "features": {
                "days_since_last_login": 7,
                "total_sessions": 45,
                "avg_session_duration": 320
            },
            "options": {
                "include_confidence": true,
                "explain_prediction": true
            }
        }
    """
    try:
        data = request.get_json()
        
        if not data or 'model_name' not in data or 'features' not in data:
            return jsonify({"error": "model_name and features are required"}), 400
        
        model_name = data['model_name']
        features = data['features']
        options = data.get('options', {})
        
        # Make prediction (mock implementation for demo)
        prediction_result = {
            "model_name": model_name,
            "prediction": "high_risk" if features.get('days_since_last_login', 0) > 14 else "low_risk",
            "confidence": 0.85,
            "features_used": list(features.keys()),
            "model_version": "1.2.0"
        }
        
        if options.get('explain_prediction'):
            prediction_result['explanation'] = {
                "top_factors": [
                    {"feature": "days_since_last_login", "importance": 0.45},
                    {"feature": "avg_session_duration", "importance": 0.32},
                    {"feature": "total_sessions", "importance": 0.23}
                ]
            }
        
        return jsonify({
            "success": True,
            "prediction": prediction_result,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })
        
    except Exception as e:
        logger.error(f"Error making prediction: {e}")
        return jsonify({"error": "Prediction failed"}), 500


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors with JSON response"""
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors with JSON response"""
    logger.error(f"Internal server error: {error}")
    return jsonify({"error": "Internal server error"}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting Python analytics service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)