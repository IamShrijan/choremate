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

# PROMPT_TEMPLATE = r"""
# You are a helpful assistant that distributes weekly chore instances fairly among household members.

# AVAILABLE CHORES (You must create instances for ALL these chores):
# {default_chores_str}

# HOUSEHOLD MEMBERS:
# {user_list_str}

# DETAILED MEMBER PREFERENCES:
# {user_preferences_str}

# TASK:
# Create WEEKLY INSTANCES of each chore based on their frequency and assign them to household members.

# IMPORTANT CONCEPTS:
# - Each chore needs to be completed multiple times per week based on its frequency
# - Daily chores need 7 instances (one for each day: Monday-Sunday)
# - Weekly chores need 1 instance (for the week)
# - Bi-weekly chores need 2 instances (for the week)

# EXAMPLE:
# - "Dishes" (Daily): Create 7 instances, assign different people to different days
# - "Kitchen Floors" (Weekly): Create 1 instance, assign to one person
# - If 3 people "don't mind" and "Kitchen Counters" is Daily (7 instances):
#   - Person A: 3 instances (Mon, Wed, Fri)
#   - Person B: 2 instances (Tue, Thu)
#   - Person C: 2 instances (Sat, Sun)
#     But, additional task must be assigned to B & C because they got only 2 instances each to balance fairness.

#   This ensures all 7 days are covered fairly!

# CRITICAL REQUIREMENTS (PRIORITY ORDER):

# 1. FAIRNESS IS MANDATORY - ALL chores MUST be completed:
#    - EVERYONE must participate in chores, even if they marked everything as "prefer to avoid"
#    - The ONLY exception: if someone has a disability/medical limitation that prevents a specific task
#    - Weekly scores (difficulty × frequency) must be balanced across ALL users
#    - Weekly score calculation: difficulty_level × instances_per_week
#      - Daily Chores (7 instances): score = difficulty × 7
#      - Weekly Chores (1 instance): score = difficulty × 1
#      - Bi-weekly Chores (2 instances): score = difficulty × 2
#    - Total weekly scores should be within 5% of each other across all users

# 2. DISTRIBUTE INSTANCES EVENLY:
#    - For Daily chores (7 instances): Split the 7 days evenly among available users

# 3. USE PREFERENCES TO GUIDE ASSIGNMENT (but don't compromise fairness):
#    - Prioritize users who marked "dont mind" for that chore
#    - Next, users who marked "neutral"
#    - Last, users who marked "prefer to avoid"
#    - BUT: If everyone marked "prefer to avoid", still assign fairly - everyone shares the burden
#    - Preferences help decide WHICH days/instances go to WHICH people, but everyone must participate

# 4. RESPECT SPECIAL REQUIREMENTS:
#    - If someone has mobility issues mentioned in special_requirements, don't assign physically demanding chores
#    - If someone has allergies, avoid assigning chores with cleaning products they're allergic to
#    - Still maintain fairness - adjust other chores to compensate

# 5. CONSIDER AVAILABILITY:
#    - Match chore timing with user's time_availability (Morning, Afternoon, Evening)
#    - Match chore days with user's day_availability (Weekday, Weekend)
#    - But don't let this compromise fairness - everyone should still get a balanced workload

# OUTPUT REQUIREMENTS:
# - For each chore, create the required number of instances based on frequency:
#   - Daily → 7 instances (Monday through Sunday)
#   - Weekly → 1 instance (specify day_of_week)
#   - Monthly → 1 instance (specify day_of_week, typically first week)
#   - One-time → 1 instance
# - Each instance must have:
#   - All chore details (name, description, difficulty, duration, frequency, priority)
#   - assigned_user_id (who does this instance)
#   - day_of_week (for Daily and Weekly chores)
# - Use exact chore names from the available chores list
# - Use the difficulty, duration, frequency, and priority from the chore definitions

# FAIRNESS VALIDATION:
# After assigning all instances, verify:
# - Every user has similar total weekly scores (within 5% difference)
# - All 7 days are covered for Daily chores
# - No user is overloaded with difficult chores
# - Distribution feels equitable considering preferences while maintaining balance

# Return ALL chore instances in the "chores" array.
# """


PROMPT_TEMPLATE = r"""
You are an expert Home Management Consultant AI. 
Your goal is to generate a comprehensive, personalized list of household chores based on specific data points
for the given house.

### INPUT DATA
1. **House Layout:** {house_layout_str}
2. **Default Chores Database:** {default_chores_str}
3. **Number of Household Members:** {number_of_household_members}
4. **User Preferences:** {user_preferences_str}

### INSTRUCTIONS
Analyze the inputs and generate a list of `GeneratedChore` objects. Follow this logic:

1.  **Layout Matching:**
    * Analyze the House Layout. If a room exists in the layout (e.g., "Guest Room"), ensure chores are assigned to it.
    * If a room is missing (e.g., user has no "Garden"), REMOVE any default chores associated with that area.
    * If the layout implies unique areas (e.g., "Home Gym"), create NEW chores appropriate for that room even if they are not in the default list.

2.  **Preference Adaptation:**
    * **Cleanliness Level:** Cleanliness is the level iof cleanliness expected for the house, where:
    if cleanliness_level is: 
        Presentable=1, 
        Livable=2, 
        Tidy=3, 
        Clean=4, 
        Spotless=5

    If users prefer a "spotless" home, increase the `chore_priority` and potentially `chore_frequency`.
    If they are "relaxed," lower the priority for non-essential tasks. Consider all the household members' preferences when you setting the values for the chores.

    * **Time Availability:** If users are "busy," keep `duration` realistic and efficient.
    * **Day Availability:** If users are "busy" on certain days, adjust the `chore_frequency` accordingly, without compromising cleanliness levels and hygiene expected.

3.  **Mandatory Rules:**
    * Hygiene-critical tasks (Dishes, Trash, Toilet Cleaning) MUST be included regardless of user preferences, though frequency can be adjusted slightly based on household size but not comromising the cleanliness level expected.

4.  **Icon/Emoji Assignment:**
    * Each chore MUST include a relevant emoji in the `icon` field. Use appropriate emojis that visually represent the chore.
    * Reference the default chores database for examples of appropriate emoji usage:
      - Kitchen-related chores: 🧽 (sponge), 🍽️ (plate), 🧹 (broom)
      - Bathroom-related chores: 🚽 (toilet), 🚿 (shower), 🪥 (toothbrush), 🧽 (sponge)
      - Cleaning chores: 🧹 (broom), 🪠 (plunger), ✨ (sparkles for dusting)
      - Trash/Garbage: 🗑️ (trash can)
      - Shopping: 🛒 (shopping cart)
      - Living areas: 🛋️ (couch)
    * For new or custom chores, choose an emoji that best represents the task. Use common, widely-supported emojis.
    * The icon should be a single emoji character (e.g., "🧽", "🍽️", "🚽") that clearly relates to the chore type.

### OUTPUT
Generate the list of chores for the house now. Ensure every chore has:
- A descriptive `name`
- A detailed `description` explaining what needs to be done
- An appropriate `icon` emoji that visually represents the chore
- Appropriate `difficulty_level`, `duration`, `chore_frequency`, and `chore_priority` values
- A `notes` field explaining why this chore is needed and how the values were determined
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
