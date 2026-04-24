from __future__ import annotations

import json
import os
from datetime import datetime
from functools import lru_cache
from typing import Any
from zoneinfo import ZoneInfo

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import StructuredTool
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.ai.chat_analytics import answer_known_question
from app.services import dashboard_data_service as data_service

SYSTEM_PROMPT = """
You are CleanSight AI Dashboard Assistant.

Rules:
1. Use available tools whenever data is required.
2. Never fabricate values, sessions, trends, anomalies, or recommendations.
3. Use dashboard context (house/room/session/date/page/chart/filters) when relevant.
4. Help with trend explanation, comparisons, anomaly analysis, and decision support.
5. If data is missing, say so clearly and suggest the next best check.
6. You know the current date from the system context included in each request.
7. Response format:
   - short answer first
   - evidence next
   - actionable suggestion last (if relevant)
"""


class SessionsByDateInput(BaseModel):
    house_id: str | None = Field(default=None)
    room_id: str | None = Field(default=None)
    date: str = Field(description="YYYY-MM-DD")


class SessionSummaryInput(BaseModel):
    session_id: str


class CompareRoomDustInput(BaseModel):
    room_a: str
    room_b: str
    date_from: str | None = Field(default=None)
    date_to: str | None = Field(default=None)


class CompareSessionsInput(BaseModel):
    room_id: str
    session_type_a: str
    session_type_b: str
    date_from: str | None = Field(default=None)
    date_to: str | None = Field(default=None)


class TrendDataInput(BaseModel):
    house_id: str | None = Field(default=None)
    room_id: str | None = Field(default=None)
    metric: str
    date_from: str | None = Field(default=None)
    date_to: str | None = Field(default=None)
    session_type: str | None = Field(default=None)


class ContextSummaryInput(BaseModel):
    context_json: str = Field(description="JSON string of current dashboard context")


class VisualizationInstructionInput(BaseModel):
    chart_type: str
    metric: str
    room_id: str
    date_from: str | None = Field(default=None)
    date_to: str | None = Field(default=None)


class AttentionRankingInput(BaseModel):
    date_from: str | None = Field(default=None)
    date_to: str | None = Field(default=None)


class DecisionSupportInput(BaseModel):
    question: str
    room_id: str | None = Field(default=None)
    house_id: str | None = Field(default=None)
    date_from: str | None = Field(default=None)
    date_to: str | None = Field(default=None)


def _tool_get_sessions_by_date(house_id: str | None, room_id: str | None, date: str) -> dict[str, Any]:
    return {
        "status": "success",
        "sessions": data_service.get_sessions(
            house_id=house_id,
            room_id=room_id,
            session_type=None,
            date_from=date,
            date_to=date,
        ),
    }


def _tool_get_session_summary(session_id: str) -> dict[str, Any]:
    return data_service.get_session_summary(session_id)


def _tool_compare_room_dust(room_a: str, room_b: str, date_from: str | None, date_to: str | None) -> dict[str, Any]:
    return data_service.compare_room_dust(room_a, room_b, date_from, date_to)


def _tool_compare_sessions(
    room_id: str,
    session_type_a: str,
    session_type_b: str,
    date_from: str | None,
    date_to: str | None,
) -> dict[str, Any]:
    return data_service.compare_sessions(room_id, session_type_a, session_type_b, date_from, date_to)


def _tool_get_trend_data(
    house_id: str | None,
    room_id: str | None,
    metric: str,
    date_from: str | None,
    date_to: str | None,
    session_type: str | None,
) -> dict[str, Any]:
    return data_service.get_trend_data(house_id, room_id, metric, date_from, date_to, session_type)


def _tool_get_anomaly_explanation(session_id: str) -> dict[str, Any]:
    return data_service.get_anomaly_explanation(session_id)


def _tool_get_dashboard_context_summary(context_json: str) -> dict[str, Any]:
    try:
        payload = json.loads(context_json)
    except json.JSONDecodeError:
        payload = {"raw_context": context_json}
    return data_service.get_dashboard_context_summary(payload)


def _tool_generate_visualization_instruction(
    chart_type: str,
    metric: str,
    room_id: str,
    date_from: str | None,
    date_to: str | None,
) -> dict[str, Any]:
    return data_service.generate_visualization_instruction(chart_type, metric, room_id, date_from, date_to)


def _tool_get_room_attention_ranking(date_from: str | None, date_to: str | None) -> dict[str, Any]:
    return data_service.get_room_attention_ranking(date_from, date_to)


def _tool_answer_decision_support_question(
    question: str,
    room_id: str | None,
    house_id: str | None,
    date_from: str | None,
    date_to: str | None,
) -> dict[str, Any]:
    return data_service.answer_decision_support_question(question, room_id, house_id, date_from, date_to)


def _build_tools() -> list[StructuredTool]:
    return [
        StructuredTool.from_function(
            name="get_sessions_by_date",
            description="Get sessions for a specific house/room/date.",
            func=_tool_get_sessions_by_date,
            args_schema=SessionsByDateInput,
        ),
        StructuredTool.from_function(
            name="get_session_summary",
            description="Get metadata and summary metrics for a session.",
            func=_tool_get_session_summary,
            args_schema=SessionSummaryInput,
        ),
        StructuredTool.from_function(
            name="compare_room_dust",
            description="Compare dust metrics between two rooms.",
            func=_tool_compare_room_dust,
            args_schema=CompareRoomDustInput,
        ),
        StructuredTool.from_function(
            name="compare_sessions",
            description="Compare before/during/after sessions by metrics.",
            func=_tool_compare_sessions,
            args_schema=CompareSessionsInput,
        ),
        StructuredTool.from_function(
            name="get_trend_data",
            description="Return trend points and summary for one metric.",
            func=_tool_get_trend_data,
            args_schema=TrendDataInput,
        ),
        StructuredTool.from_function(
            name="get_anomaly_explanation",
            description="Explain anomalies in a session.",
            func=_tool_get_anomaly_explanation,
            args_schema=SessionSummaryInput,
        ),
        StructuredTool.from_function(
            name="get_dashboard_context_summary",
            description="Summarize active dashboard context.",
            func=_tool_get_dashboard_context_summary,
            args_schema=ContextSummaryInput,
        ),
        StructuredTool.from_function(
            name="generate_visualization_instruction",
            description="Generate visualization instruction/config guidance.",
            func=_tool_generate_visualization_instruction,
            args_schema=VisualizationInstructionInput,
        ),
        StructuredTool.from_function(
            name="get_room_attention_ranking",
            description="Rank rooms by attention score.",
            func=_tool_get_room_attention_ranking,
            args_schema=AttentionRankingInput,
        ),
        StructuredTool.from_function(
            name="answer_decision_support_question",
            description="Generate evidence-based decision support summary.",
            func=_tool_answer_decision_support_question,
            args_schema=DecisionSupportInput,
        ),
    ]


@lru_cache(maxsize=1)
def _tool_registry() -> dict[str, StructuredTool]:
    return {tool.name: tool for tool in _build_tools()}


@lru_cache(maxsize=1)
def _llm():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not configured on the backend. Add it to backend/.env and restart the backend."
        )

    model_name = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
    return ChatOpenAI(
        model=model_name,
        api_key=api_key,
        temperature=0.2,
    )


def _history_to_messages(messages: list[dict[str, Any]]) -> list[Any]:
    converted: list[Any] = []
    for msg in messages[:-1]:
        role = str(msg.get("role") or "")
        content = str(msg.get("content") or "")
        if role == "user":
            converted.append(HumanMessage(content=content))
        elif role == "assistant":
            converted.append(AIMessage(content=content))
    return converted


def run_chat(messages: list[dict[str, Any]], dashboard_context: dict[str, Any] | None) -> str:
    if not messages:
        return "Please provide a question."

    latest_message = messages[-1]
    user_input = str(latest_message.get("content") or "").strip()
    if not user_input:
        return "Please provide a question."

    context_payload = dashboard_context or {}
    context_text = json.dumps(context_payload, ensure_ascii=True)

    try:
        direct_answer = answer_known_question(messages, context_payload)
    except RuntimeError as exc:
        return f"I tried to query Firebase for that answer, but the database is not available right now. Detail: {str(exc)}"
    if direct_answer:
        return direct_answer

    try:
        llm = _llm()
    except RuntimeError as exc:
        return (
            "I can answer CleanSight analytics questions from Firebase, but general chatbot reasoning needs "
            f"the OpenAI key configured. Backend detail: {str(exc)}"
        )

    tools = _build_tools()
    tool_lookup = _tool_registry()
    llm_with_tools = llm.bind_tools(tools)
    today_text = datetime.now(ZoneInfo("Asia/Colombo")).strftime("%Y-%m-%d")

    convo: list[Any] = [
        SystemMessage(content=SYSTEM_PROMPT),
        * _history_to_messages(messages),
        HumanMessage(
            content=(
                f"Current date: {today_text}\n"
                f"User question: {user_input}\n\n"
                f"Dashboard context JSON:\n{context_text}"
            )
        ),
    ]

    for _ in range(6):
        ai_response = llm_with_tools.invoke(convo)
        convo.append(ai_response)

        tool_calls = getattr(ai_response, "tool_calls", None) or []
        if not tool_calls:
            content = ai_response.content
            if isinstance(content, str):
                return content.strip() or "I could not generate a response."
            if isinstance(content, list):
                text_parts = [part.get("text", "") for part in content if isinstance(part, dict)]
                merged = "\n".join([part for part in text_parts if part]).strip()
                return merged or "I could not generate a response."
            return "I could not generate a response."

        for call in tool_calls:
            tool_name = call.get("name")
            tool_id = call.get("id", "")
            args = call.get("args", {}) or {}
            tool = tool_lookup.get(tool_name or "")
            if not tool:
                result_payload = {"status": "error", "message": f"Unknown tool: {tool_name}"}
            else:
                try:
                    result_payload = tool.invoke(args)
                except Exception as exc:
                    result_payload = {"status": "error", "message": f"Tool '{tool_name}' failed: {str(exc)}"}

            convo.append(
                ToolMessage(
                    content=json.dumps(result_payload, ensure_ascii=True),
                    tool_call_id=tool_id,
                )
            )

    return "I could not complete the analysis in time. Please try with a narrower question."
