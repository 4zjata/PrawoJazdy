"""
Solver skrzyżowań oparty na grafie skierowanym (DAG).

Waliduje kolejność przejazdu pojazdów za pomocą sortowania topologicznego
(algorytm Kahna). Akceptuje każdą poprawną kolejność topologiczną.
"""

from collections import defaultdict, deque

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intersection import (
    IntersectionVehicle,
    IntersectionPriorityEdge,
)


def topological_sort(
    vehicles: list[str],
    edges: list[tuple[str, str, str]],
) -> list[str]:
    """
    Sortowanie topologiczne algorytmem Kahna.

    Args:
        vehicles: Lista etykiet pojazdów
        edges: Lista krawędzi (yielding, priority, rule) -
               yielding ustępuje priority (priority jedzie pierwszy)

    Returns:
        Lista pojazdów w kolejności przejazdu (pierwszeństwo pierwszy)

    Raises:
        ValueError: Jeśli wykryto cykl w grafie
    """
    in_degree = {v: 0 for v in vehicles}
    adjacency = defaultdict(list)

    for yielding, priority, _rule in edges:
        # priority jedzie przed yielding, więc krawędź: priority -> yielding
        adjacency[priority].append(yielding)
        in_degree[yielding] += 1

    queue = deque()
    for v in vehicles:
        if in_degree[v] == 0:
            queue.append(v)

    result = []
    while queue:
        # Sortujemy dla deterministycznego wyniku
        queue = deque(sorted(queue))
        node = queue.popleft()
        result.append(node)

        for neighbor in adjacency[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(result) != len(vehicles):
        raise ValueError(
            "Wykryto cykl w grafie pierwszeństwa - scenariusz jest niepoprawny"
        )

    return result


def validate_order(
    user_order: list[str],
    edges: list[tuple[str, str, str]],
) -> list[dict]:
    """
    Waliduje kolejność podaną przez użytkownika.

    Sprawdza każdą krawędź: czy pojazd z pierwszeństwem (priority)
    jest PRZED pojazdem ustępującym (yielding) w kolejności użytkownika.

    Returns:
        Lista naruszeń (pusta jeśli kolejność poprawna)
    """
    violations = []
    order_index = {label: idx for idx, label in enumerate(user_order)}

    for yielding, priority, rule in edges:
        if priority not in order_index or yielding not in order_index:
            continue

        # priority musi być przed yielding (mniejszy indeks)
        if order_index[priority] > order_index[yielding]:
            violations.append(
                {
                    "yielding_vehicle": yielding,
                    "priority_vehicle": priority,
                    "rule": rule,
                    "message": (
                        f"Pojazd {yielding} musiał ustąpić pojazdowi {priority} "
                        f"ze względu na: {rule}"
                    ),
                }
            )

    return violations


async def get_scenario_edges(
    db: AsyncSession, scenario_id: int
) -> tuple[list[str], list[tuple[str, str, str]]]:
    """Pobiera pojazdy i krawędzie scenariusza z bazy danych."""
    v_result = await db.execute(
        select(IntersectionVehicle).where(
            IntersectionVehicle.scenario_id == scenario_id
        )
    )
    vehicles_db = list(v_result.scalars().all())
    vehicle_map = {v.id: v.vehicle_label for v in vehicles_db}
    vehicle_labels = [v.vehicle_label for v in vehicles_db]

    e_result = await db.execute(
        select(IntersectionPriorityEdge).where(
            IntersectionPriorityEdge.scenario_id == scenario_id
        )
    )
    edges_db = list(e_result.scalars().all())

    edges = []
    for edge in edges_db:
        yielding = vehicle_map.get(edge.from_vehicle_id, "?")
        priority = vehicle_map.get(edge.to_vehicle_id, "?")
        edges.append((yielding, priority, edge.rule_description))

    return vehicle_labels, edges


async def solve_and_validate(
    db: AsyncSession, scenario_id: int, user_order: list[str]
) -> dict:
    """Rozwiązuje scenariusz i waliduje odpowiedź użytkownika."""
    vehicle_labels, edges = await get_scenario_edges(db, scenario_id)

    user_set = set(user_order)
    expected_set = set(vehicle_labels)
    if user_set != expected_set:
        missing = expected_set - user_set
        extra = user_set - expected_set
        msg_parts = []
        if missing:
            msg_parts.append(f"Brakujące pojazdy: {', '.join(sorted(missing))}")
        if extra:
            msg_parts.append(f"Nieznane pojazdy: {', '.join(sorted(extra))}")
        raise ValueError(". ".join(msg_parts))

    violations = validate_order(user_order, edges)
    is_correct = len(violations) == 0

    correct_order = topological_sort(vehicle_labels, edges)

    return {
        "is_correct": is_correct,
        "submitted_order": user_order,
        "violations": violations,
        "correct_order_example": correct_order if not is_correct else None,
    }


async def get_hint(db: AsyncSession, scenario_id: int) -> dict:
    """Zwraca podpowiedź - pojazdy z najwyższym pierwszeństwem."""
    vehicle_labels, edges = await get_scenario_edges(db, scenario_id)

    in_degree = {v: 0 for v in vehicle_labels}
    for yielding, priority, _rule in edges:
        in_degree[yielding] += 1

    first_vehicles = [v for v in vehicle_labels if in_degree[v] == 0]

    return {
        "scenario_id": scenario_id,
        "hint_type": "first_to_go",
        "hint": (
            f"Jako pierwsi jadą: {', '.join(sorted(first_vehicles))}. "
            f"Mają najwyższe pierwszeństwo (nikt im nie ustępuje)."
        ),
        "vehicles_that_go_first": sorted(first_vehicles),
    }
