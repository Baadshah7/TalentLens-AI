import hashlib
import json
from typing import List, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session
import models

# Global model cache (lazy loaded)
_model = None

def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        # Load the lightweight, high-performance all-MiniLM-L6-v2 model
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    return _model

def calculate_text_hash(text: str) -> str:
    """Computes MD5 hash of input text for caching lookup keys."""
    # Ensure text is normalized (stripped and lower-cased) to avoid unnecessary recalculations
    normalized = text.strip().lower()
    return hashlib.md5(normalized.encode('utf-8')).hexdigest()

def get_embedding(text: str, db: Session, entity_type: str = "sentence", entity_id: Optional[int] = None) -> List[float]:
    """Retrieves embedding from database cache, falling back to model execution and cache write."""
    if not text.strip():
        # Return empty list or zeros
        return [0.0] * 384  # MiniLM outputs 384 dimensions

    text_hash = calculate_text_hash(text)
    
    # 1. Query SQLite Cache
    cached = db.query(models.EmbeddingCache).filter(models.EmbeddingCache.Text_Hash == text_hash).first()
    if cached:
        try:
            return json.loads(cached.Vector)
        except Exception as e:
            print(f"Failed to deserialize cached vector: {e}")
            # fall through to recalculate

    # 2. Execute sentence transformer model
    model = get_model()
    # Ensure text is string and run encode
    embedding_arr = model.encode(text)
    vector = embedding_arr.tolist()

    # 3. Store vector back in EmbeddingCache
    try:
        # Check if hash was inserted concurrently
        duplicate_check = db.query(models.EmbeddingCache).filter(models.EmbeddingCache.Text_Hash == text_hash).first()
        if not duplicate_check:
            cache_entry = models.EmbeddingCache(
                Entity_Type=entity_type,
                Entity_ID=entity_id,
                Text_Hash=text_hash,
                Vector=json.dumps(vector)
            )
            db.add(cache_entry)
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"Failed to write to embedding cache: {e}")
        
    return vector

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Calculates cosine similarity between two dimensional vectors (ranges between -1 and 1)."""
    a = np.array(v1)
    b = np.array(v2)
    
    a_norm = np.linalg.norm(a)
    b_norm = np.linalg.norm(b)
    
    if a_norm == 0 or b_norm == 0:
        return 0.0
        
    return float(np.dot(a, b) / (a_norm * b_norm))
