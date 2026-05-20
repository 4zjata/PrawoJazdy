from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.intersection import (
    IntersectionScenario,
    IntersectionVehicle,
    UserIntersectionAttempt,
)
from app.schemas.intersection import (
    IntersectionListResponse,
    IntersectionDetailResponse,
    SolveRequest,
    SolveResponse,
    ViolationResponse,
    HintResponse,
)
from app.services.intersection_service import solve_and_validate, get_hint

router = APIRouter(prefix="/intersections", tags=["intersections"])


@router.get("", response_model=list[IntersectionListResponse])
async def list_scenarios(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lista wszystkich scenariuszy skrzyżowań."""
    result = await db.execute(
        select(IntersectionScenario).order_by(IntersectionScenario.difficulty)
    )
    return list(result.scalars().all())


@router.get("/{scenario_id}", response_model=IntersectionDetailResponse)
async def get_scenario(
    scenario_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Szczegóły scenariusza z pojazdami."""
    result = await db.execute(
        select(IntersectionScenario)
        .options(selectinload(IntersectionScenario.vehicles))
        .where(IntersectionScenario.id == scenario_id)
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenariusz nie znaleziony")
    return scenario


@router.post("/{scenario_id}/solve", response_model=SolveResponse)
async def solve_scenario(
    scenario_id: int,
    data: SolveRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Waliduje kolejność przejazdu za pomocą DAG."""
    # Check scenario exists
    result = await db.execute(
        select(IntersectionScenario).where(IntersectionScenario.id == scenario_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Scenariusz nie znaleziony")

    try:
        solve_result = await solve_and_validate(db, scenario_id, data.order)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Save attempt
    attempt = UserIntersectionAttempt(
        user_id=user.id,
        scenario_id=scenario_id,
        submitted_order=data.order,
        is_correct=solve_result["is_correct"],
        feedback=solve_result["violations"] if solve_result["violations"] else None,
        attempted_at=datetime.utcnow(),
    )
    db.add(attempt)

    violations = [
        ViolationResponse(**v) for v in solve_result["violations"]
    ]

    return SolveResponse(
        is_correct=solve_result["is_correct"],
        submitted_order=solve_result["submitted_order"],
        violations=violations,
        correct_order_example=solve_result["correct_order_example"],
    )


@router.get("/{scenario_id}/hint", response_model=HintResponse)
async def get_scenario_hint(
    scenario_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Podpowiedź do scenariusza."""
    result = await db.execute(
        select(IntersectionScenario).where(IntersectionScenario.id == scenario_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Scenariusz nie znaleziony")

    return await get_hint(db, scenario_id)
