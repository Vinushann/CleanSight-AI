from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(default="", max_length=20000)


class ChatDateRange(BaseModel):
    from_date: str | None = Field(default=None, alias="from")
    to_date: str | None = Field(default=None, alias="to")

    class Config:
        populate_by_name = True


class DashboardContext(BaseModel):
    house_id: str | None = None
    room_id: str | None = None
    session_type: str | None = None
    date_range: ChatDateRange | None = None
    selected_page: str | None = None
    selected_chart: str | None = None
    filters: dict[str, Any] | None = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    dashboard_context: DashboardContext | None = None
