from bson import ObjectId
from gridfs import GridFS

from app.models.persistence.db import MongoDB
from app.utils.time import utc_now_iso


class DocumentRepository:
    _INDEXES = [
        {"keys": [("doc_id", 1)], "options": {"unique": True, "name": "uq_doc_id"}},
        {"keys": [("user_id", 1)], "options": {"name": "idx_user_id_asc"}},
        {"keys": [("report_type", 1)], "options": {"name": "idx_report_type_asc"}},
        {"keys": [("module", 1)], "options": {"name": "idx_module_asc"}},
        {"keys": [("created_at", 1)], "options": {"name": "idx_created_at_asc"}},
    ]

    def __init__(
        self,
        mongo_uri: str,
        db_name: str,
        mongodb: MongoDB | None = None,
        collection_name: str = "documents",
        collection=None,
    ) -> None:
        self.mongodb = mongodb or MongoDB(
            mongo_uri=mongo_uri,
            db_name=db_name,
            collection_name=collection_name,
        )
        if collection is None:
            self.mongodb.ensure_indexes(self._INDEXES)
            self.collection = self.mongodb.collection
        else:
            self.collection = collection

        self.fs = GridFS(self.mongodb.database)

    def create_document(self, metadata: dict, file_bytes: bytes) -> dict:
        now_iso = utc_now_iso()
        file_id = self.fs.put(
            file_bytes,
            filename=metadata["filename"],
            content_type=metadata.get("content_type", "application/pdf"),
            metadata={"doc_id": metadata["doc_id"]},
        )
        row = {
            **metadata,
            "file_id": str(file_id),
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        self.collection.insert_one(row)
        return row

    def list_documents(self, doc_type: str, user_id: str, limit: int = 200) -> list[dict]:
        cursor = (
            self.collection.find(
                {"doc_type": doc_type, "user_id": user_id},
                {"_id": 0},
            )
            .sort("created_at", -1)
            .limit(max(1, int(limit)))
        )
        return list(cursor)

    def get_document(self, doc_id: str) -> dict | None:
        return self.collection.find_one({"doc_id": doc_id}, {"_id": 0})

    def read_file_bytes(self, file_id: str) -> bytes:
        grid_out = self.fs.get(ObjectId(file_id))
        return grid_out.read()
