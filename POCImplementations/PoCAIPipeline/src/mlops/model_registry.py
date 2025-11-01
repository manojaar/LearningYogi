"""
Model Registry for versioning and managing models

Provides model registration, versioning, and retrieval.
"""

import os
import mlflow
from typing import List, Optional, Dict, Any
from pathlib import Path


class ModelRegistry:
    """Model registry for managing model versions"""
    
    def __init__(self, mlflow_tracking_uri: Optional[str] = None):
        """
        Initialize model registry
        
        Args:
            mlflow_tracking_uri: MLflow tracking URI
        """
        tracking_uri = mlflow_tracking_uri or os.getenv(
            'MLFLOW_TRACKING_URI',
            'http://localhost:5000'
        )
        mlflow.set_tracking_uri(tracking_uri)
    
    def register_model(
        self,
        model_path: str,
        model_name: str,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> mlflow.entities.model_registry.ModelVersion:
        """
        Register model in registry
        
        Args:
            model_path: Path to model directory
            model_name: Model name
            description: Model description
            metadata: Additional metadata
        
        Returns:
            ModelVersion object
        """
        try:
            # Create model if doesn't exist
            try:
                mlflow.register_model(f"runs:/{model_path}", model_name)
            except Exception:
                # Model might already exist, that's okay
                pass
            
            # Get latest version
            versions = mlflow.search_model_versions(f"name='{model_name}'")
            if versions:
                latest_version = max(versions, key=lambda v: v.version)
                return latest_version
            
            raise ValueError(f"Failed to register model {model_name}")
        except Exception as e:
            print(f"Failed to register model: {e}")
            raise
    
    def list_model_versions(self, model_name: str) -> List[mlflow.entities.model_registry.ModelVersion]:
        """List all versions of a model"""
        try:
            return mlflow.search_model_versions(f"name='{model_name}'")
        except Exception as e:
            print(f"Failed to list versions: {e}")
            return []
    
    def get_model(self, model_name: str, version: Optional[int] = None) -> Any:
        """
        Get model from registry
        
        Args:
            model_name: Model name
            version: Optional version number (defaults to latest)
        
        Returns:
            Loaded model
        """
        try:
            if version:
                model_uri = f"models:/{model_name}/{version}"
            else:
                model_uri = f"models:/{model_name}/latest"
            
            return mlflow.pyfunc.load_model(model_uri)
        except Exception as e:
            print(f"Failed to load model: {e}")
            raise
    
    def set_production(self, model_name: str, version: int):
        """Set model version to production"""
        try:
            client = mlflow.tracking.MlflowClient()
            client.transition_model_version_stage(
                name=model_name,
                version=version,
                stage="Production"
            )
        except Exception as e:
            print(f"Failed to set production: {e}")
            raise


class ModelEvaluator:
    """Model evaluator for comparing models"""
    
    def evaluate(
        self,
        model_path: str,
        test_dataset: str,
        metrics: Optional[List[str]] = None
    ) -> Dict[str, float]:
        """
        Evaluate model on test dataset
        
        Args:
            model_path: Path to model
            test_dataset: Path to test dataset
            metrics: List of metrics to compute
        
        Returns:
            Dictionary of metric values
        """
        # Placeholder implementation
        # In production, implement actual evaluation logic
        metrics = metrics or ["accuracy", "f1_score", "inference_time"]
        
        return {
            metric: 0.0 for metric in metrics
        }
    
    def compare_models(
        self,
        models: List[str],
        test_dataset: str
    ) -> Dict[str, Dict[str, float]]:
        """
        Compare multiple models
        
        Args:
            models: List of model paths
            test_dataset: Test dataset path
        
        Returns:
            Dictionary of results for each model
        """
        results = {}
        for model_path in models:
            results[model_path] = self.evaluate(model_path, test_dataset)
        return results

