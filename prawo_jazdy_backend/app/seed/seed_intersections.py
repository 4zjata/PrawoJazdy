"""
Seed data for intersection scenarios.

Creates 5+ intersection scenarios with vehicles and priority edges (DAG).
Each scenario is a directed acyclic graph representing right-of-way rules.
"""

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session as async_session_maker, create_tables
from app.models.intersection import (
    IntersectionScenario,
    IntersectionVehicle,
    IntersectionPriorityEdge,
    IntersectionDifficulty,
    VehicleType,
)


SCENARIOS = [
    # ── Scenario 1: EASY – Simple 4-way, 2 cars, right-hand rule ──
    {
        "name": "Skrzyżowanie równorzędne – zasada prawej ręki",
        "description": (
            "Skrzyżowanie równorzędne dwóch dróg. Dwa samochody osobowe "
            "zbliżają się do skrzyżowania. Obowiązuje zasada prawej ręki."
        ),
        "difficulty": IntersectionDifficulty.EASY,
        "image_filename": "intersection_01.png",
        "scenario_data": {"type": "4-way", "traffic_lights": False, "signs": []},
        "vehicles": [
            {
                "label": "A",
                "type": VehicleType.CAR,
                "from": "N",
                "to": "S",
                "position": "Samochód A jedzie z północy na południe (prosto)",
            },
            {
                "label": "B",
                "type": VehicleType.CAR,
                "from": "W",
                "to": "E",
                "position": "Samochód B jedzie z zachodu na wschód (prosto)",
            },
        ],
        # B is on A's right → A yields to B → B goes first
        "edges": [
            ("A", "B", "Zasada prawej ręki – pojazd B jest po prawej stronie pojazdu A"),
        ],
    },
    # ── Scenario 2: EASY – T-junction with yield sign ──
    {
        "name": "Skrzyżowanie z drogą z pierwszeństwem (znak A-7)",
        "description": (
            "Skrzyżowanie typu T. Samochód A jedzie drogą z pierwszeństwem. "
            "Samochód B wyjeżdża z drogi podporządkowanej (znak A-7 – ustąp pierwszeństwa)."
        ),
        "difficulty": IntersectionDifficulty.EASY,
        "image_filename": "intersection_02.png",
        "scenario_data": {"type": "T-junction", "traffic_lights": False, "signs": ["A-7"]},
        "vehicles": [
            {
                "label": "A",
                "type": VehicleType.CAR,
                "from": "W",
                "to": "E",
                "position": "Samochód A jedzie drogą z pierwszeństwem (z zachodu na wschód)",
            },
            {
                "label": "B",
                "type": VehicleType.CAR,
                "from": "S",
                "to": "N",
                "position": "Samochód B wyjeżdża z drogi podporządkowanej (z południa)",
            },
        ],
        # B has yield sign → B yields to A → A goes first
        "edges": [
            ("B", "A", "Znak A-7 (ustąp pierwszeństwa) – pojazd B musi ustąpić pojazdowi A na drodze z pierwszeństwem"),
        ],
    },
    # ── Scenario 3: MEDIUM – 4-way with tram + 2 cars ──
    {
        "name": "Skrzyżowanie równorzędne z tramwajem",
        "description": (
            "Skrzyżowanie równorzędne. Tramwaj T jedzie z zachodu na wschód. "
            "Dwa samochody (A i B) zbliżają się z północy i południa. "
            "Na skrzyżowaniu równorzędnym tramwaj ma zawsze pierwszeństwo."
        ),
        "difficulty": IntersectionDifficulty.MEDIUM,
        "image_filename": "intersection_03.png",
        "scenario_data": {"type": "4-way", "traffic_lights": False, "signs": [], "tram_tracks": True},
        "vehicles": [
            {
                "label": "T",
                "type": VehicleType.TRAM,
                "from": "W",
                "to": "E",
                "position": "Tramwaj T jedzie z zachodu na wschód (prosto)",
            },
            {
                "label": "A",
                "type": VehicleType.CAR,
                "from": "N",
                "to": "S",
                "position": "Samochód A jedzie z północy na południe (prosto)",
            },
            {
                "label": "B",
                "type": VehicleType.CAR,
                "from": "S",
                "to": "N",
                "position": "Samochód B jedzie z południa na północ (prosto)",
            },
        ],
        # Tram always has priority on equal-rank intersection
        # A and B are opposite → no conflict between them (both go straight)
        "edges": [
            ("A", "T", "Tramwaj ma pierwszeństwo na skrzyżowaniu równorzędnym – pojazd A ustępuje tramwajowi T"),
            ("B", "T", "Tramwaj ma pierwszeństwo na skrzyżowaniu równorzędnym – pojazd B ustępuje tramwajowi T"),
        ],
    },
    # ── Scenario 4: MEDIUM – Roundabout with 3 vehicles ──
    {
        "name": "Rondo z trzema pojazdami",
        "description": (
            "Rondo (skrzyżowanie o ruchu okrężnym) ze znakiem C-12. "
            "Trzy pojazdy: A jest już na rondzie, B i C wjeżdżają. "
            "Pojazdy na rondzie mają pierwszeństwo przed wjeżdżającymi."
        ),
        "difficulty": IntersectionDifficulty.MEDIUM,
        "image_filename": "intersection_04.png",
        "scenario_data": {"type": "roundabout", "traffic_lights": False, "signs": ["C-12"]},
        "vehicles": [
            {
                "label": "A",
                "type": VehicleType.CAR,
                "from": "rondo",
                "to": "E",
                "position": "Samochód A jest już na rondzie i zjeżdża na wschód",
            },
            {
                "label": "B",
                "type": VehicleType.CAR,
                "from": "N",
                "to": "rondo",
                "position": "Samochód B wjeżdża na rondo od północy",
            },
            {
                "label": "C",
                "type": VehicleType.CAR,
                "from": "S",
                "to": "rondo",
                "position": "Samochód C wjeżdża na rondo od południa",
            },
        ],
        # A is on roundabout → B and C must yield to A
        # B and C enter independently (no conflict between them)
        "edges": [
            ("B", "A", "Rondo (C-12) – pojazdy na rondzie mają pierwszeństwo; B ustępuje A"),
            ("C", "A", "Rondo (C-12) – pojazdy na rondzie mają pierwszeństwo; C ustępuje A"),
        ],
    },
    # ── Scenario 5: HARD – Emergency vehicle + tram + 3 cars ──
    {
        "name": "Złożone skrzyżowanie z pojazdem uprzywilejowanym i tramwajem",
        "description": (
            "Skrzyżowanie z sygnalizacją świetlną (niedziałającą – mrugające żółte). "
            "Pojazd uprzywilejowany K (karetka z sygnałami) zbliża się z północy. "
            "Tramwaj T jedzie z zachodu na wschód. "
            "Samochody A, B i C na pozostałych wlotach. "
            "Kolejność: pojazd uprzywilejowany > tramwaj > zasada prawej ręki."
        ),
        "difficulty": IntersectionDifficulty.HARD,
        "image_filename": "intersection_05.png",
        "scenario_data": {
            "type": "4-way",
            "traffic_lights": True,
            "lights_status": "flashing_yellow",
            "signs": [],
            "tram_tracks": True,
        },
        "vehicles": [
            {
                "label": "K",
                "type": VehicleType.EMERGENCY,
                "from": "N",
                "to": "S",
                "position": "Karetka K z włączonymi sygnałami jedzie z północy na południe",
            },
            {
                "label": "T",
                "type": VehicleType.TRAM,
                "from": "W",
                "to": "E",
                "position": "Tramwaj T jedzie z zachodu na wschód",
            },
            {
                "label": "A",
                "type": VehicleType.CAR,
                "from": "E",
                "to": "W",
                "position": "Samochód A jedzie ze wschodu na zachód (prosto)",
            },
            {
                "label": "B",
                "type": VehicleType.CAR,
                "from": "S",
                "to": "N",
                "position": "Samochód B jedzie z południa na północ (prosto)",
            },
            {
                "label": "C",
                "type": VehicleType.CAR,
                "from": "S",
                "to": "W",
                "position": "Samochód C jedzie z południa, skręca na zachód (w lewo)",
            },
        ],
        # K (emergency) goes first – everyone yields to K
        # T (tram) goes second – remaining cars yield to T
        # A and B go straight opposite directions but A is on B's right? 
        # B goes south→north, C goes south→west (turning left)
        # B and C start from same direction; C turns left so C yields to oncoming A
        # A goes east→west (straight), B goes south→north (straight)
        # B is on A's right → A yields to B
        "edges": [
            ("T", "K", "Pojazd uprzywilejowany (karetka K z sygnałami) ma pierwszeństwo przed wszystkimi"),
            ("A", "K", "Pojazd uprzywilejowany (karetka K z sygnałami) ma pierwszeństwo przed wszystkimi"),
            ("B", "K", "Pojazd uprzywilejowany (karetka K z sygnałami) ma pierwszeństwo przed wszystkimi"),
            ("C", "K", "Pojazd uprzywilejowany (karetka K z sygnałami) ma pierwszeństwo przed wszystkimi"),
            ("A", "T", "Tramwaj ma pierwszeństwo na skrzyżowaniu równorzędnym"),
            ("B", "T", "Tramwaj ma pierwszeństwo na skrzyżowaniu równorzędnym"),
            ("C", "T", "Tramwaj ma pierwszeństwo na skrzyżowaniu równorzędnym"),
            ("A", "B", "Zasada prawej ręki – pojazd B jest po prawej stronie pojazdu A"),
            ("C", "A", "Pojazd C skręca w lewo i musi ustąpić pojazdowi A jadącemu z naprzeciwka na wprost"),
            ("C", "B", "Pojazd C skręca w lewo i musi ustąpić pojazdowi B; B ma pierwszeństwo (prawa ręka wobec C)"),
        ],
    },
    # ── Scenario 6: MEDIUM – 4-way with signs (droga z pierwszeństwem + podporządkowana) ──
    {
        "name": "Skrzyżowanie z drogą z pierwszeństwem – 3 pojazdy",
        "description": (
            "Skrzyżowanie oznaczone znakiem D-1 (droga z pierwszeństwem) na osi N-S. "
            "Samochód A jedzie drogą z pierwszeństwem z N na S. "
            "Samochód B jedzie drogą z pierwszeństwem z S, skręca w prawo (na W). "
            "Samochód C wyjeżdża z drogi podporządkowanej od W (znak A-7)."
        ),
        "difficulty": IntersectionDifficulty.MEDIUM,
        "image_filename": "intersection_06.png",
        "scenario_data": {"type": "4-way", "traffic_lights": False, "signs": ["D-1", "A-7"]},
        "vehicles": [
            {
                "label": "A",
                "type": VehicleType.CAR,
                "from": "N",
                "to": "S",
                "position": "Samochód A jedzie drogą z pierwszeństwem z N na S (prosto)",
            },
            {
                "label": "B",
                "type": VehicleType.CAR,
                "from": "S",
                "to": "W",
                "position": "Samochód B jedzie drogą z pierwszeństwem z S, skręca w prawo (na W)",
            },
            {
                "label": "C",
                "type": VehicleType.CAR,
                "from": "W",
                "to": "E",
                "position": "Samochód C wyjeżdża z drogi podporządkowanej (znak A-7) od W",
            },
        ],
        # A and B on priority road, C on subordinate
        # C yields to both A and B
        # A goes straight, B turns right – no conflict between A and B
        "edges": [
            ("C", "A", "Znak A-7 – pojazd C z drogi podporządkowanej ustępuje pojazdowi A z drogi z pierwszeństwem"),
            ("C", "B", "Znak A-7 – pojazd C z drogi podporządkowanej ustępuje pojazdowi B z drogi z pierwszeństwem"),
        ],
    },
    # ── Scenario 7: HARD – 4-way with priority road changing direction + tram ──
    {
        "name": "Droga z pierwszeństwem zmieniająca kierunek + tramwaj",
        "description": (
            "Skrzyżowanie z drogą z pierwszeństwem zmieniającą kierunek (D-1 + T-6a): "
            "pierwszeństwo skręca z N na W. "
            "Tramwaj T jedzie drogą podporządkowaną z E na W. "
            "Samochód A jedzie drogą z pierwszeństwem z N, skręca w lewo (na W). "
            "Samochód B jedzie drogą z pierwszeństwem z W, skręca w prawo (na N). "
            "Samochód C z drogi podporządkowanej z S."
        ),
        "difficulty": IntersectionDifficulty.HARD,
        "image_filename": "intersection_07.png",
        "scenario_data": {
            "type": "4-way",
            "traffic_lights": False,
            "signs": ["D-1", "T-6a", "A-7"],
            "tram_tracks": True,
        },
        "vehicles": [
            {
                "label": "A",
                "type": VehicleType.CAR,
                "from": "N",
                "to": "W",
                "position": "Samochód A jedzie drogą z pierwszeństwem z N, skręca w lewo (na W)",
            },
            {
                "label": "B",
                "type": VehicleType.CAR,
                "from": "W",
                "to": "N",
                "position": "Samochód B jedzie drogą z pierwszeństwem z W, skręca w prawo (na N)",
            },
            {
                "label": "T",
                "type": VehicleType.TRAM,
                "from": "E",
                "to": "W",
                "position": "Tramwaj T jedzie drogą podporządkowaną z E na W",
            },
            {
                "label": "C",
                "type": VehicleType.CAR,
                "from": "S",
                "to": "N",
                "position": "Samochód C z drogi podporządkowanej z S, jedzie na N",
            },
        ],
        # A and B on priority road – they go first
        # A turns left, B turns right – no conflict (compatible movements)
        # T (tram) on subordinate road but tram has priority over cars on same-rank road
        # T and C are both on subordinate road; T is a tram so T > C
        # C yields to everyone
        "edges": [
            ("T", "A", "Droga z pierwszeństwem – tramwaj T z drogi podporządkowanej ustępuje pojazdowi A"),
            ("T", "B", "Droga z pierwszeństwem – tramwaj T z drogi podporządkowanej ustępuje pojazdowi B"),
            ("C", "A", "Droga z pierwszeństwem – pojazd C z drogi podporządkowanej ustępuje pojazdowi A"),
            ("C", "B", "Droga z pierwszeństwem – pojazd C z drogi podporządkowanej ustępuje pojazdowi B"),
            ("C", "T", "Na drodze podporządkowanej tramwaj T ma pierwszeństwo przed samochodem C"),
        ],
    },
]


async def seed_intersections(db: AsyncSession) -> None:
    """Seed intersection scenarios into the database."""
    # Check if already seeded
    result = await db.execute(select(IntersectionScenario))
    existing = result.scalars().first()
    if existing:
        print("Intersection scenarios already seeded, skipping.")
        return

    for scenario_data in SCENARIOS:
        scenario = IntersectionScenario(
            name=scenario_data["name"],
            description=scenario_data["description"],
            difficulty=scenario_data["difficulty"],
            image_filename=scenario_data.get("image_filename"),
            scenario_data=scenario_data.get("scenario_data"),
        )
        db.add(scenario)
        await db.flush()

        # Create vehicles
        vehicle_map: dict[str, int] = {}
        for v in scenario_data["vehicles"]:
            vehicle = IntersectionVehicle(
                scenario_id=scenario.id,
                vehicle_label=v["label"],
                vehicle_type=v["type"],
                direction_from=v["from"],
                direction_to=v["to"],
                position_description=v["position"],
            )
            db.add(vehicle)
            await db.flush()
            vehicle_map[v["label"]] = vehicle.id

        # Create priority edges
        for yielding_label, priority_label, rule in scenario_data["edges"]:
            edge = IntersectionPriorityEdge(
                scenario_id=scenario.id,
                from_vehicle_id=vehicle_map[yielding_label],
                to_vehicle_id=vehicle_map[priority_label],
                rule_description=rule,
            )
            db.add(edge)

    await db.commit()
    print(f"Seeded {len(SCENARIOS)} intersection scenarios.")


async def main():
    await create_tables()
    async with async_session_maker() as db:
        await seed_intersections(db)


if __name__ == "__main__":
    asyncio.run(main())
