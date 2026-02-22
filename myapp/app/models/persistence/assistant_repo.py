from app.models.persistence.db import MongoDB
from app.utils.hashing import sha256_text
from app.utils.time import utc_now_iso


class AssistantConversationRepository:
    _INDEXES = [
        {"keys": [("message_id", 1)], "options": {"unique": True, "name": "uq_message_id"}},
        {"keys": [("conversation_id", 1)], "options": {"name": "idx_conversation_id_asc"}},
        {"keys": [("created_at", 1)], "options": {"name": "idx_created_at_asc"}},
    ]

    def __init__(
        self,
        mongo_uri: str,
        db_name: str,
        mongodb: MongoDB | None = None,
        collection_name: str = "assistant_conversations",
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

    def add_message(
        self,
        conversation_id: str,
        role: str,
        text: str,
        context_page: str,
    ) -> str:
        now_iso = utc_now_iso()
        message_id = sha256_text(f"{conversation_id}|{role}|{text}|{now_iso}")[:24]
        self.collection.insert_one(
            {
                "message_id": message_id,
                "conversation_id": conversation_id,
                "role": role,
                "text": text,
                "context_page": context_page,
                "created_at": now_iso,
            }
        )
        return message_id

    def list_messages(self, conversation_id: str, limit: int = 12) -> list[dict]:
        cursor = (
            self.collection.find({"conversation_id": conversation_id}, {"_id": 0})
            .sort("created_at", -1)
            .limit(max(1, int(limit)))
        )
        rows = list(cursor)
        rows.reverse()
        return rows
