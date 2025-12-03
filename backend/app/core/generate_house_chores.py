import os
from pathlib import Path
from dotenv import load_dotenv
import json
from typing import Dict, Any, List, Optional, Literal
from sqlalchemy.orm import Session
from collections import defaultdict

from google import genai
from google.genai import types
from pydantic import BaseModel, Field, ValidationError

from ..models.model import House, User, UserPreference, Chore
from ..schemas.chore_and_ticket import GeneratedChore
from .default_chores import get_default_chores


PROMPT_TEMPLATE = r"""
You are an expert Home Management Consultant AI. 
Your goal is to generate a simple, practical list of household chores that balances everyone's preferences without overwhelming the household.

### INPUT DATA
1. **House Layout:** {house_layout_str}
2. **Default Chores Database:** {default_chores_str}
3. **Number of Household Members:** {number_of_household_members}
4. **User Preferences:** {user_preferences_str}

### CLEANLINESS LEVEL GUIDE
Cleanliness levels range from 1 (Presentable) to 5 (Spotless):
- **1 - Presentable:** Basic hygiene only. Essential tasks like dishes and trash.
- **2 - Livable:** Minimal cleaning. Core hygiene tasks plus light tidying.
- **3 - Tidy:** Regular cleaning. Standard weekly maintenance.
- **4 - Clean:** Thorough cleaning. Weekly deep cleaning included.
- **5 - Spotless:** Intensive cleaning. Daily attention to detail.

### KEY PRINCIPLES

1. **Balance Cleanliness Levels:**
   - Calculate the AVERAGE cleanliness level across all household members
   - For hygiene-critical tasks (Dishes, Trash, Toilet Cleaning): Use the HIGHEST cleanliness level among all members to ensure no one's hygiene standards are compromised
   - For non-essential tasks: Use the AVERAGE cleanliness level to avoid overwhelming members who prefer simpler routines
   - NEVER create chores that only satisfy the highest cleanliness level - balance is key

2. **Respect Availability (KEEP IT SIMPLE):**
   - If users have LIMITED time availability (only 1-2 time slots selected), reduce the number of chores significantly
   - Focus on essential tasks only when availability is constrained
   - If most users are "busy" (limited time slots), create a minimal chore list (8-12 chores max)
   - If users have generous availability, you can include more comprehensive tasks

3. **Chore Frequency Based on Cleanliness:**
   - **Levels 1-2:** Essential tasks only, lower frequency (e.g., Weekly or Bi-weekly)
   - **Level 3:** Standard tasks, moderate frequency (e.g., Weekly)
   - **Levels 4-5:** Comprehensive tasks, higher frequency (e.g., Daily or Twice a week)
   - Match frequency to the calculated cleanliness level - don't overdo it

4. **Task Selection:**
   - **ALWAYS INCLUDE:** Hygiene-critical tasks (Dishes, Trash, Bathroom cleaning) - these are non-negotiable
   - **INCLUDE IF:** Average cleanliness level is 3+ (moderate tidying tasks)
   - **INCLUDE IF:** Average cleanliness level is 4+ (deep cleaning tasks)
   - **EXCLUDE IF:** Average cleanliness level is 1-2 (only essential hygiene)
   - **EXCLUDE:** Decorative or optional tasks if users indicate they're busy

5. **Duration Estimates:**
   - Keep durations realistic and efficient
   - For busy households: Prioritize shorter, focused tasks
   - Don't create tasks longer than 30-45 minutes unless absolutely necessary for the cleanliness level

6. **Layout Matching:**
   - Only include chores for rooms that exist in the house layout
   - Remove default chores for areas not present (e.g., no Garden = no garden chores)
   - Create room-specific chores only if the room exists

### GENERATION RULES

**Step 1: Analyze Household Preferences**
- Calculate average cleanliness level: Sum all cleanliness levels ÷ number of members
- Identify highest cleanliness level (for hygiene-critical tasks)
- Assess availability: Count how many time slots users selected (busy = 1-2 slots, normal = 3-4 slots)
- Determine if household is "busy" (majority have limited availability)

**Step 2: Determine Chore Count**
- **Busy household + Low cleanliness (1-2):** 6-8 essential chores only
- **Busy household + Medium cleanliness (3):** 8-10 core chores
- **Normal availability + Medium cleanliness (3):** 10-12 standard chores
- **Normal availability + High cleanliness (4-5):** 12-15 comprehensive chores
- **High cleanliness (4-5) + Not busy:** 15-18 thorough chores

**Step 3: Create Chores**
- Start with hygiene-critical tasks (use highest cleanliness level for frequency/priority)
- Add standard cleaning tasks (use average cleanliness level)
- Add advanced tasks only if average cleanliness level warrants it
- Keep it simple - don't create redundant or overlapping chores
- Each chore should have clear purpose and reasonable duration

**Step 4: Set Values**
- `difficulty_level`: 1-5 based on physical/intellectual demand
- `duration`: Realistic time estimate in minutes (5-45 min typically)
- `chore_frequency`: Based on cleanliness level requirement
  - Hygiene-critical: Always frequent (Daily or Twice a week)
  - Essential: Weekly minimum
  - Standard: Weekly or Bi-weekly
  - Advanced: Monthly or as needed
- `chore_priority`: 
  - Hygiene-critical: Always High (3)
  - Essential for cleanliness level: Medium-High (2-3)
  - Optional/nice-to-have: Low-Medium (1-2)
- `notes`: Explain why this chore exists and how values were determined based on preferences

### OUTPUT
Generate a BALANCED, SIMPLE list of chores that:
- Respects the highest cleanliness level for hygiene-critical tasks
- Uses average cleanliness level for general tasks
- Keeps chore count reasonable based on availability
- Focuses on essential tasks when users are busy
- Never overwhelms the household

Ensure every chore has:
- A descriptive `name`
- A detailed `description` explaining what needs to be done
- An appropriate `icon` emoji (single character: 🧽, 🍽️, 🚽, etc.)
- Appropriate `difficulty_level` (1-5), `duration` (minutes), `chore_frequency`, and `chore_priority` (1-3)
- A `notes` field explaining the reasoning based on cleanliness levels and availability
"""


class GeneratedChoresResponse(BaseModel):
    """Schema for the complete response from Gemini - simple list of chores"""

    chores: List[GeneratedChore] = Field(
        description="List of generated chores for the household, each with a reason for the creation"
    )


# Lazy initialization: client will be created on first use and cached
_client: Optional[genai.Client] = None


def get_gemini_client() -> genai.Client:
    """
    Get or create the Gemini client instance (singleton pattern).
    Client is created once on first call and reused for subsequent calls.
    """
    global _client

    if _client is None:
        # Get the directory where this file is located
        current_file = Path(__file__)
        # Navigate to backend directory (go up 2 levels: core -> app -> backend)
        backend_dir = current_file.parent.parent.parent
        # Construct path to .env file in backend directory
        env_path = backend_dir / ".env"

        # Try to load from .env file if it exists
        if env_path.exists():
            load_dotenv(dotenv_path=str(env_path))

        # Also try loading without explicit path (load_dotenv searches automatically)
        load_dotenv()

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError(
                "GEMINI_API_KEY environment variable not set. "
                f"Please set it in your environment or in the .env file at: {env_path}"
            )
        _client = genai.Client(api_key=api_key.strip())

    return _client


def get_fairness_score(chores: List[GeneratedChore]) -> int:
    """
    Calculate the fairness score for a list of chores assigned to a user.
    For now, this sums up the total time (duration in minutes) spent on all chores.

    Args:
        chores: List of GeneratedChore objects assigned to a user

    Returns:
        Total duration in minutes (fairness score)
    """
    total_duration = 0
    for chore in chores:
        total_duration += chore.duration

    return total_duration


def generate_house_chores(db: Session, house_id: str) -> Dict[str, Any]:
    """
    Generate chores for a house based on house layout and user preferences using Gemini AI.
    Gemini returns a list of chores with assigned_user_id, and this function groups them by user.

    Returns a dictionary with status and chores grouped by user_id.
    """
    # 1. Get house information
    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        return {"status": "error", "message": "House not found"}

    # 2. Get all users in the house with their preferences
    users = db.query(User).filter(User.house_id == house_id).all()
    if not users:
        return {"status": "error", "message": "No users found in the house"}

    # 3. Build user preferences data for the prompt
    number_of_household_members = len(users)
    house_layout_str = json.dumps(house.house_layout, indent=2)
    default_chores = get_default_chores()
    default_chores_str = "\n".join(
        [json.dumps(chore, indent=2) for chore in default_chores]
    )

    # 4. Build user preferences data for the prompt
    users_data = []
    for user in users:
        preferences = (
            db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
        )

        user_info = {
            "name": user.name,
        }

        if preferences:
            user_info["preferences"] = {
                "cleanliness_level": preferences.cleanliness_level,
                "time_availability": preferences.time_availability or [],
                "day_availability": preferences.day_availability or [],
                # "chore_preferences": preferences.chore_preferences or {},
                # "special_requirements": preferences.special_requirements or "",
            }
        else:
            user_info["preferences"] = None

        users_data.append(user_info)

    # 4. Build all dynamic parts for the prompt
    # User preferences string
    user_preferences_str_parts = []
    for user_data in users_data:
        pref_str = f"\nUser: {user_data['name']}\n"
        if user_data["preferences"]:
            prefs = user_data["preferences"]
            pref_str += f"  - Cleanliness Level: {prefs.get('cleanliness_level', 'Not set')}/5\n"
            pref_str += f"  - Time Availability: {', '.join(prefs.get('time_availability', [])) or 'Not specified'}\n"
            pref_str += f"  - Day Availability: {', '.join(prefs.get('day_availability', [])) or 'Not specified'}\n"
        else:
            pref_str += "  - No preferences set yet\n"

        user_preferences_str_parts.append(pref_str)

    user_preferences_str = "\n".join(user_preferences_str_parts)

    # 5. Format the complete prompt
    prompt = PROMPT_TEMPLATE.format(
        house_layout_str=house_layout_str,
        number_of_household_members=number_of_household_members,
        default_chores_str=default_chores_str,
        user_preferences_str=user_preferences_str,
    )

    # 6. Get or create Gemini client (lazy initialization - created once, reused)
    try:
        client = get_gemini_client()
    except ValueError as e:
        return {"status": "error", "message": str(e)}

    try:
        # 7. Generate content with structured output
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GeneratedChoresResponse.model_json_schema(),
                thinking_config=types.ThinkingConfig(
                    include_thoughts=True,
                ),
            ),
        )

        # 8. Parse and validate the response
        generated_data = GeneratedChoresResponse.model_validate_json(response.text)

        # 9. Convert all GeneratedChore objects to dictionaries for JSON serialization
        all_chores_list = [chore.model_dump() for chore in generated_data.chores]
        print(f"all_chores_list: {all_chores_list}")

        # 10. Calculate total number of household chores created
        total_chores_created = len(generated_data.chores)

        # 11. Return the result with all chores and total count
        return {
            "status": "success",
            "total_chores_created": total_chores_created,
            "chores": all_chores_list,
        }

    except ValidationError as e:
        return {"status": "error", "message": f"Failed to parse AI response: {str(e)}"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to generate chores: {str(e)}"}
