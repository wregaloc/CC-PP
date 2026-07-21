import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.client import Client


class ClientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)


class ClientUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=150)


class ClientOut(BaseModel):
    id: uuid.UUID
    name: str
    is_active: bool
    user_count: int
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, client: Client, *, user_count: int) -> "ClientOut":
        return cls(
            id=client.id,
            name=client.name,
            is_active=client.is_active,
            user_count=user_count,
            created_at=client.created_at,
            updated_at=client.updated_at,
        )


class PaginatedClients(BaseModel):
    items: list[ClientOut]
    page: int
    page_size: int
    total: int
