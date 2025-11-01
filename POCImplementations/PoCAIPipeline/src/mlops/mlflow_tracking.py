"""
MLflow Integration for Experiment Tracking

Provides MLflow tracking for training experiments and model registry.
"""

import os
from contextlib import contextmanager
from typing import Dict, Any, Optional
import mlflow
import mlflow.pytorch


class MLflowTracker:
    """MLflow experiment tracker"""
    
    def __init__(
        self,
        tracking_uri: Optional[str] = None,
        experiment_name: Optional[str] = None
    ):
        """
        Initialize MLflow tracker
        
        Args:
            tracking_uri: MLflow tracking URI
            experiment_name: Experiment name
        """
        tracking_uri = tracking_uri or os.getenv(
            'MLFLOW_TRACKING_URI',
            'http://localhost:5000'
        )
        
        mlflow.set_tracking_uri(tracking_uri)
        
        experiment_name = experiment_name or os.getenv(
            'MLFLOW_EXPERIMENT_NAME',
            'timetable-extraction'
        )
        
        try:
            experiment = mlflow.get_experiment_by_name(experiment_name)
            if experiment is None:
                experiment_id = mlflow.create_experiment(experiment_name)
            else:
                experiment_id = experiment.experiment_id
            
            mlflow.set_experiment(experiment_name)
        except Exception as e:
            print(f"Failed to set up experiment: {e}")
            print("Using default experiment")
    
    @contextmanager
    def start_run(self, run_name: Optional[str] = None):
        """
        Context manager for MLflow run
        
        Args:
            run_name: Optional run name
        """
        with mlflow.start_run(run_name=run_name):
            yield self
    
    def log_params(self, params: Dict[str, Any]):
        """Log parameters"""
        mlflow.log_params(params)
    
    def log_metrics(self, metrics: Dict[str, float], step: Optional[int] = None):
        """Log metrics"""
        mlflow.log_metrics(metrics, step=step)
    
    def log_metric(self, key: str, value: float, step: Optional[int] = None):
        """Log single metric"""
        mlflow.log_metric(key, value, step=step)
    
    def log_model(self, model: Any, artifact_path: str):
        """Log model"""
        mlflow.pytorch.log_model(model, artifact_path)
    
    def log_artifact(self, local_path: str):
        """Log artifact"""
        mlflow.log_artifact(local_path)
    
    def log_artifacts(self, local_dir: str):
        """Log directory of artifacts"""
        mlflow.log_artifacts(local_dir)

