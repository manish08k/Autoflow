"""Marketplace — publish/install/rate shared workflow templates and node packs."""
import re
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from storage.models import MarketplaceItem


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


async def list_items(db: AsyncSession, category: str | None = None, item_type: str | None = None,
                      search: str | None = None, page: int = 1, limit: int = 20):
    query = select(MarketplaceItem).where(MarketplaceItem.is_published == True)  # noqa: E712
    if category:
        query = query.where(MarketplaceItem.category == category)
    if item_type:
        query = query.where(MarketplaceItem.item_type == item_type)
    if search:
        query = query.where(or_(
            MarketplaceItem.name.ilike(f"%{search}%"),
            MarketplaceItem.description.ilike(f"%{search}%"),
        ))
    query = query.order_by(MarketplaceItem.downloads.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def get_item(db: AsyncSession, slug: str) -> MarketplaceItem | None:
    result = await db.execute(
        select(MarketplaceItem).where(MarketplaceItem.slug == slug, MarketplaceItem.is_published == True)  # noqa: E712
    )
    return result.scalar_one_or_none()


async def publish_item(db: AsyncSession, org_id: str | None, name: str, description: str,
                        category: str, tags: list[str], item_type: str, content: dict) -> MarketplaceItem:
    slug = _slugify(name)
    existing = await db.execute(select(MarketplaceItem).where(MarketplaceItem.slug == slug))
    if existing.scalar_one_or_none():
        raise ValueError("An item with this name already exists")

    item = MarketplaceItem(
        org_id=org_id,
        name=name,
        slug=slug,
        description=description,
        category=category,
        tags=tags,
        item_type=item_type,
        content=content,
        is_published=True,
    )
    db.add(item)
    return item


async def install_item(db: AsyncSession, slug: str) -> MarketplaceItem:
    result = await db.execute(
        select(MarketplaceItem).where(MarketplaceItem.slug == slug, MarketplaceItem.is_published == True)  # noqa: E712
    )
    item = result.scalar_one_or_none()
    if not item:
        raise ValueError("Item not found")
    item.downloads += 1
    return item


async def rate_item(db: AsyncSession, slug: str, rating: int) -> MarketplaceItem:
    if rating < 1 or rating > 5:
        raise ValueError("Rating must be between 1 and 5")
    result = await db.execute(select(MarketplaceItem).where(MarketplaceItem.slug == slug))
    item = result.scalar_one_or_none()
    if not item:
        raise ValueError("Item not found")
    item.rating += rating
    item.rating_count += 1
    return item


async def unpublish_item(db: AsyncSession, slug: str, org_id: str) -> MarketplaceItem:
    result = await db.execute(
        select(MarketplaceItem).where(MarketplaceItem.slug == slug, MarketplaceItem.org_id == org_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise ValueError("Item not found or not owned by your org")
    item.is_published = False
    return item
