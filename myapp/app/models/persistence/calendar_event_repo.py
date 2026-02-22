from app.models.persistence.db import MongoDB
from app.utils.time import utc_now_iso


class CalendarEventRepository:
    _INDEXES = [
        {"keys": [("event_id", 1)], "options": {"unique": True, "name": "uq_event_id"}},
        {"keys": [("start_at", 1)], "options": {"name": "idx_start_at_asc"}},
        {"keys": [("task_id", 1)], "options": {"name": "idx_task_id_asc"}},
    ]

    def __init__(
        self,
        mongo_uri: str,
        db_name: str,
        mongodb: MongoDB | None = None,
        collection_name: str = "calendar_events",
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

    def list_events(
        self,
        start_at: str | None = None,
        end_at: str | None = None,
        limit: int = 500,
    ) -> list[dict]:
        query: dict = {}
        if start_at or end_at:
            range_query: dict = {}
            if start_at:
                range_query["$gte"] = start_at
            if end_at:
                range_query["$lte"] = end_at
            query["start_at"] = range_query

        cursor = (
            self.collection.find(query, {"_id": 0})
            .sort("start_at", 1)
            .limit(max(1, int(limit)))
        )
        return list(cursor)

    def replace_events(self, events: list[dict]) -> int:
        self.collection.delete_many({})
        if not events:
            return 0

        now_iso = utc_now_iso()
        for event in events:
            event.setdefault("created_at", now_iso)
            event["updated_at"] = now_iso
        self.collection.insert_many(events)
        return len(events)

    def upsert_events(self, events: list[dict]) -> int:
        if not events:
            return 0

        now_iso = utc_now_iso()
        for event in events:
            event["updated_at"] = now_iso
            self.collection.update_one(
                {"event_id": event["event_id"]},
                {
                    "$set": event,
                    "$setOnInsert": {"created_at": now_iso},
                },
                upsert=True,
            )
        return len(events)
