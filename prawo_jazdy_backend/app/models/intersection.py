import enum
from datetime import datetime

from sqlalchemy import Integer, String, Enum, Text, JSON, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class IntersectionDifficulty(str, enum.Enum):
    EASY = "EASY"
    MEDIUM = "MEDIUM"
    HARD = "HARD"


class VehicleType(str, enum.Enum):
    CAR = "CAR"
    TRUCK = "TRUCK"
    TRAM = "TRAM"
    EMERGENCY = "EMERGENCY"
    BICYCLE = "BICYCLE"
    PEDESTRIAN = "PEDESTRIAN"
    USER = "USER"


class IntersectionScenario(Base):
    __tablename__ = "intersection_scenarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[IntersectionDifficulty] = mapped_column(
        Enum(IntersectionDifficulty), nullable=False
    )
    image_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    scenario_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    vehicles = relationship(
        "IntersectionVehicle", back_populates="scenario", cascade="all, delete-orphan"
    )
    priority_edges = relationship(
        "IntersectionPriorityEdge",
        back_populates="scenario",
        cascade="all, delete-orphan",
    )


class IntersectionVehicle(Base):
    __tablename__ = "intersection_vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scenario_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("intersection_scenarios.id"), nullable=False
    )
    vehicle_label: Mapped[str] = mapped_column(String(50), nullable=False)
    vehicle_type: Mapped[VehicleType] = mapped_column(Enum(VehicleType), nullable=False)
    direction_from: Mapped[str] = mapped_column(String(10), nullable=False)
    direction_to: Mapped[str] = mapped_column(String(10), nullable=False)
    position_description: Mapped[str] = mapped_column(Text, nullable=False)

    scenario = relationship("IntersectionScenario", back_populates="vehicles")


class IntersectionPriorityEdge(Base):
    __tablename__ = "intersection_priority_edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scenario_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("intersection_scenarios.id"), nullable=False
    )
    from_vehicle_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("intersection_vehicles.id"), nullable=False
    )
    to_vehicle_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("intersection_vehicles.id"), nullable=False
    )
    rule_description: Mapped[str] = mapped_column(Text, nullable=False)

    scenario = relationship("IntersectionScenario", back_populates="priority_edges")
    from_vehicle = relationship("IntersectionVehicle", foreign_keys=[from_vehicle_id])
    to_vehicle = relationship("IntersectionVehicle", foreign_keys=[to_vehicle_id])


class UserIntersectionAttempt(Base):
    __tablename__ = "user_intersection_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    scenario_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("intersection_scenarios.id"), nullable=False
    )
    submitted_order: Mapped[dict | None] = mapped_column(JSON, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    feedback: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    attempted_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    user = relationship("User", back_populates="intersection_attempts")
    scenario = relationship("IntersectionScenario")
