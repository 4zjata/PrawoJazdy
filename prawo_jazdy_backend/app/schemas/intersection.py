from datetime import datetime

from pydantic import BaseModel


class VehicleResponse(BaseModel):
    id: int
    vehicle_label: str
    vehicle_type: str
    direction_from: str
    direction_to: str
    position_description: str

    model_config = {"from_attributes": True}


class PriorityEdgeResponse(BaseModel):
    from_vehicle_label: str
    to_vehicle_label: str
    rule_description: str


class IntersectionListResponse(BaseModel):
    id: int
    name: str
    description: str
    difficulty: str
    image_filename: str | None = None

    model_config = {"from_attributes": True}


class IntersectionDetailResponse(BaseModel):
    id: int
    name: str
    description: str
    difficulty: str
    image_filename: str | None = None
    scenario_data: dict | None = None
    vehicles: list[VehicleResponse]

    model_config = {"from_attributes": True}


class SolveRequest(BaseModel):
    order: list[str]


class ViolationResponse(BaseModel):
    yielding_vehicle: str
    priority_vehicle: str
    rule: str
    message: str


class SolveResponse(BaseModel):
    is_correct: bool
    submitted_order: list[str]
    violations: list[ViolationResponse]
    correct_order_example: list[str] | None = None


class HintResponse(BaseModel):
    scenario_id: int
    hint_type: str
    hint: str
    vehicles_that_go_first: list[str]


class IntersectionAttemptResponse(BaseModel):
    id: int
    scenario_id: int
    submitted_order: list[str]
    is_correct: bool
    feedback: dict | None = None
    attempted_at: datetime

    model_config = {"from_attributes": True}
