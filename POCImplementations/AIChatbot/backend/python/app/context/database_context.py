"""
Database context service - queries POC database for timetable/document data
"""

import os
import sqlite3
from typing import Optional, Dict, Any, List
from pathlib import Path


class DatabaseContextService:
    """Service for querying POC database for context"""

    def __init__(self):
        self.db_path = os.environ.get("POC_DB_URL") or os.environ.get("CHATBOT_DB_URL")
        self.enabled = os.environ.get("CHATBOT_ENABLE_CONTEXT", "false").lower() == "true"
        
        if self.db_path and not Path(self.db_path).is_absolute():
            # Relative path, try to find in common locations
            base_paths = [
                Path("../../POCDemoImplementation/data/database/app.db"),
                Path("./data/database/app.db"),
                Path("/data/database/app.db"),  # Docker volume mount path
            ]
            for base_path in base_paths:
                if base_path.is_absolute() and base_path.exists():
                    self.db_path = str(base_path)
                    break
                else:
                    full_path = Path(__file__).parent.parent.parent.parent / base_path
                    if full_path.exists():
                        self.db_path = str(full_path)
                        break
        
        # If still relative, try absolute path resolution
        if self.db_path and not Path(self.db_path).is_absolute():
            # Try as absolute path from root
            abs_path = Path(self.db_path)
            if abs_path.exists():
                self.db_path = str(abs_path.absolute())

    def is_available(self) -> bool:
        """Check if database context is available"""
        if not self.enabled:
            return False
        if not self.db_path:
            return False
        return Path(self.db_path).exists()

    def get_document_info(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Get document information by ID"""
        if not self.is_available():
            return None

        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, filename, file_type, file_size, status, created_at
                FROM documents
                WHERE id = ?
            """, (document_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if row:
                return dict(row)
            return None
        except Exception as e:
            print(f"Error querying document: {e}")
            return None

    def get_timetable_info(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Get timetable information for a document"""
        if not self.is_available():
            return None

        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, document_id, teacher_name, class_name, term, year,
                       timeblocks, confidence, validated, created_at
                FROM timetables
                WHERE document_id = ?
            """, (document_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if row:
                data = dict(row)
                # Parse JSON timeblocks if present
                if data.get("timeblocks"):
                    try:
                        import json
                        data["timeblocks"] = json.loads(data["timeblocks"])
                    except:
                        pass
                return data
            return None
        except Exception as e:
            print(f"Error querying timetable: {e}")
            return None

    def search_documents(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search documents by filename"""
        if not self.is_available():
            return []

        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, filename, file_type, status, created_at
                FROM documents
                WHERE filename LIKE ?
                ORDER BY created_at DESC
                LIMIT ?
            """, (f"%{query}%", limit))
            
            rows = cursor.fetchall()
            conn.close()
            
            return [dict(row) for row in rows]
        except Exception as e:
            print(f"Error searching documents: {e}")
            return []

    def get_context_for_message(self, document_id: Optional[str] = None) -> Dict[str, Any]:
        """Get relevant context for a chat message"""
        context = {
            "has_database": self.is_available(),
            "document": None,
            "timetable": None
        }

        if document_id and self.is_available():
            context["document"] = self.get_document_info(document_id)
            if context["document"]:
                context["timetable"] = self.get_timetable_info(document_id)

        return context

