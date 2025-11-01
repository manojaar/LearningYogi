"""
Feature Store Client for Feast

Provides interface for retrieving and storing features
from Feast feature store with Redis online store.
"""

import os
from typing import List, Dict, Optional, Any
from feast import FeatureStore


class FeatureStoreClient:
    """Client for interacting with Feast feature store"""
    
    def __init__(self, repo_path: Optional[str] = None):
        """
        Initialize feature store client
        
        Args:
            repo_path: Path to Feast feature repository
        """
        repo_path = repo_path or os.getenv(
            'FEATURE_STORE_REPO_PATH',
            'feature_repo'
        )
        
        try:
            self.store = FeatureStore(repo_path=repo_path)
            print(f"Feature store initialized from {repo_path}")
        except Exception as e:
            print(f"Failed to initialize feature store: {e}")
            self.store = None
    
    def get_online_features(
        self,
        entity_ids: List[str],
        feature_names: List[str]
    ) -> Dict[str, Any]:
        """
        Get online features for entities
        
        Args:
            entity_ids: List of entity IDs (document IDs)
            feature_names: List of feature names to retrieve
        
        Returns:
            Dictionary of features for each entity
        """
        if not self.store:
            return {}
        
        try:
            entity_rows = [{"document": doc_id} for doc_id in entity_ids]
            
            feature_refs = [
                f"{view_name}:{feat_name}"
                for feat_name in feature_names
                for view_name in ["ocr_features", "document_features", "timetable_features"]
            ]
            
            features = self.store.get_online_features(
                entity_rows=entity_rows,
                features=feature_refs
            )
            
            return features.to_dict()
        except Exception as e:
            print(f"Failed to get features: {e}")
            return {}
    
    def store_features(self, entity_id: str, features: Dict[str, Any]):
        """
        Store features for an entity
        
        Note: In production, features should be written to offline store
        and materialized to online store. This is a simplified version.
        
        Args:
            entity_id: Document entity ID
            features: Dictionary of features to store
        """
        # In production implementation:
        # 1. Write to offline store (Parquet files)
        # 2. Materialize to online store (Redis)
        # For now, this is a placeholder
        print(f"Storing features for {entity_id}: {features}")
    
    def get_features(
        self,
        entity_id: str,
        feature_names: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Convenience method to get features for a single entity
        
        Args:
            entity_id: Document entity ID
            feature_names: Optional list of specific features
        
        Returns:
            Dictionary of features
        """
        if feature_names is None:
            feature_names = [
                "confidence",
                "layout_score",
                "word_count",
                "extraction_confidence"
            ]
        
        result = self.get_online_features([entity_id], feature_names)
        return result.get(entity_id, {})


class FeatureStoreWriter:
    """Writer for storing features in feature store"""
    
    def __init__(self, store_client: Optional[FeatureStoreClient] = None):
        """
        Initialize feature writer
        
        Args:
            store_client: Feature store client instance
        """
        self.client = store_client or FeatureStoreClient()
    
    def store_ocr_features(
        self,
        document_id: str,
        text: str,
        confidence: float,
        word_count: int,
        layout_score: Optional[float] = None,
        time_pattern_count: Optional[int] = None
    ):
        """
        Store OCR features
        
        Args:
            document_id: Document entity ID
            text: Extracted text
            confidence: OCR confidence score
            word_count: Number of words
            layout_score: Layout consistency score
            time_pattern_count: Number of time patterns found
        """
        features = {
            'text': text,
            'confidence': confidence,
            'word_count': word_count,
            'layout_score': layout_score or 0.8,
            'time_pattern_count': time_pattern_count or 0
        }
        
        self.client.store_features(document_id, features)
    
    def store_document_features(
        self,
        document_id: str,
        extraction_confidence: float,
        timeblock_count: int,
        has_teacher: bool,
        has_class: bool
    ):
        """
        Store document extraction features
        
        Args:
            document_id: Document entity ID
            extraction_confidence: Extraction confidence score
            timeblock_count: Number of timeblocks extracted
            has_teacher: Whether teacher name was found
            has_class: Whether class name was found
        """
        features = {
            'extraction_confidence': extraction_confidence,
            'timeblock_count': timeblock_count,
            'has_teacher': has_teacher,
            'has_class': has_class
        }
        
        self.client.store_features(document_id, features)

