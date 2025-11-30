"""
Default chores list that all houses can use.
Users provide preferences (neutral, dont mind, prefer to avoid) for these chores.
"""

from typing import List, Dict, Any, Optional

CHORES: List[Dict[str, Any]] = [
    {
        "name": "Kitchen Counters",
        "description": "Clean and wipe down kitchen countertops and surfaces",
        "difficulty_level": 2,
        "duration": 15,
        "chore_frequency": "Daily",
        "chore_priority": 2,
        "notes": "Clean kitchen counters and surfaces",
    },
    {
        "name": "Dishes",
        "description": "Wash dishes, load/unload dishwasher, or hand wash",
        "difficulty_level": 2,
        "duration": 15,
        "chore_frequency": "Daily",
        "chore_priority": 3,
        "notes": "Wash dishes, load/unload dishwasher, or hand wash",
    },
    {
        "name": "Kitchen Floors",
        "description": "Sweep and mop kitchen floor area",
        "difficulty_level": 2,
        "duration": 20,
        "chore_frequency": "Weekly",
        "chore_priority": 2,
        "notes": "Sweep and mop kitchen floor area",
    },
    {
        "name": "Taking Out Trash",
        "description": "Take out trash and recycling bins to the curb or disposal area",
        "difficulty_level": 1,
        "duration": 10,
        "chore_frequency": "Weekly",
        "chore_priority": 2,
        "notes": "Take out trash and recycling bins to the curb or disposal area",
    },
    {
        "name": "Cleaning Toilet",
        "description": "Clean and sanitize toilet bowl, seat, and surrounding area",
        "difficulty_level": 3,
        "duration": 30,
        "chore_frequency": "Weekly",
        "chore_priority": 2,
        "notes": "Clean and sanitize toilet bowl, seat, and surrounding area",
    },
    {
        "name": "Cleaning Shower",
        "description": "Clean shower/tub area including walls, floor, and fixtures",
        "difficulty_level": 3,
        "duration": 30,
        "chore_frequency": "Weekly",
        "chore_priority": 2,
        "notes": "Clean shower/tub area including walls, floor, and fixtures",
    },
    {
        "name": "Bathroom Sink",
        "description": "Clean and sanitize bathroom sink, mirror, and counter area",
        "difficulty_level": 2,
        "duration": 20,
        "chore_frequency": "Weekly",
        "chore_priority": 2,
        "notes": "Clean and sanitize bathroom sink, mirror, and counter area",
    },
    {
        "name": "Bathroom Floors",
        "description": "Sweep and mop bathroom floor area",
        "difficulty_level": 2,
        "duration": 20,
        "chore_frequency": "Weekly",
        "chore_priority": 2,
        "notes": "Sweep and mop bathroom floor area",
    },
    {
        "name": "Living Room Tidying",
        "description": "Tidy up living room, organize items, fluff cushions, arrange furniture",
        "difficulty_level": 1,
        "duration": 10,
        "chore_frequency": "Daily",
        "chore_priority": 1,
        "notes": "Tidy up living room, organize items, fluff cushions, arrange furniture",
    },
    {
        "name": "Vacuuming",
        "description": "Vacuum carpets, rugs, and floor areas throughout the house",
        "difficulty_level": 2,
        "duration": 30,
        "chore_frequency": "Weekly",
        "chore_priority": 2,
        "notes": "Vacuum carpets, rugs, and floor areas throughout the house",
    },
    {
        "name": "Dusting",
        "description": "Dust and clean furniture, shelves, and surfaces throughout the house",
        "difficulty_level": 1,
        "duration": 20,
        "chore_frequency": "Weekly",
        "chore_priority": 1,
        "notes": "Dust furniture, shelves, and surfaces throughout the house",
    },
    {
        "name": "Grocery Shopping",
        "description": "Plan meals, create shopping list, and purchase household groceries",
        "difficulty_level": 2,
        "duration": 45,
        "chore_frequency": "Weekly",
        "chore_priority": 3,
        "notes": "Plan meals, create shopping list, and purchase household groceries",
    },
]


def get_default_chores() -> List[Dict[str, Any]]:
    """
    Returns the list of default chores available for all houses.
    """
    return CHORES


def get_chore_names() -> List[str]:
    """
    Returns just the names of default chores.
    Useful for validating user preferences.
    """
    return [chore["name"] for chore in CHORES]


def get_chore_by_name(name: str) -> Optional[Dict[str, Any]]:
    """
    Get a default chore by its name.
    Returns None if not found.
    """
    for chore in CHORES:
        if chore["name"].lower() == name.lower():
            return chore
    return None
