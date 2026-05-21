"""Bump existing download-category orders to make room for Word Searches at position 2."""
import asyncio, os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))


ORDERS = {
    "coloring-pages": 1,
    "word-searches": 2,
    "activity-sheets": 3,
    "parent-guides": 4,
    "classroom-resources": 5,
    "camp-director-resources": 6,
    "posters-printables": 7,
    "wave-lessons": 8,
}


async def main():
    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = c[os.environ["DB_NAME"]]
    for slug, order in ORDERS.items():
        r = await db.download_categories.update_one({"slug": slug}, {"$set": {"order": order}})
        print(f"  {slug} -> order {order} (matched {r.matched_count})")

asyncio.run(main())
