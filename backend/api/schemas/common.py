from pydantic import BaseModel


class DetailResponse(BaseModel):
    detail: str


class HealthResponse(BaseModel):
    status: str


class ScopeUpdateResponse(BaseModel):
    detail: str
    scopes: str


class BackupResponse(BaseModel):
    detail: str
    filename: str | None = None
    timestamp: str


class QueueRefreshResponse(BaseModel):
    detail: str
