import os
from pathlib import Path
from dotenv import load_dotenv
import json
from typing import Dict, Any, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from collections import defaultdict

from google import genai
from google.genai import types
from pydantic import BaseModel, Field, ValidationError

from ..models.model import House, User, UserPreference, Chore, Ticket
from ..core.generate_house_chores import get_gemini_client

PROMPT_TEMPLATE = r"""
You are an expert Home Management AI that creates fair monthly chore assignments for household members.

### HOUSEHOLD CONTEXT
**House Members:**
{user_list_str}

**User Preferences:**
{user_preferences_str}

**Available Chores:**
{chores_str}

### TASK
Generate monthly ticket assignments for the upcoming month (starting {month_start_date}).
For each chore, determine:
1. Which day(s) of the month with due date it should be done (based on frequency)
2. Which household member should be assigned (based on preferences, availability, and fairness)

### ASSIGNMENT RULES
1. **Frequency Mapping:**
   - Daily → Assign to different days (distribute across the week)
   - Twice a week → Assign to 2 days (e.g., Monday and Thursday)
   - Weekly → Assign to 1 day (typically Monday or based on preference)
   - Once in two weeks → Assign to 1 day (2 weeks of the month only)
   - Monthly → Assign to 1 day (1 day of the month only)

2. **Fairness:**
   - Distribute chores evenly across all household members
   - Consider each member's current workload (balance total duration)
   - Ensure no one is overloaded

3. **Preferences:**
   - Respect day_availability (Weekday vs Weekend)
   - Respect time_availability when possible
   - Consider special_requirements (e.g., avoid physically demanding tasks for those with limitations)

IMPORTANT: You MUST use the exact chore IDs and user IDs provided above. Do not invent or modify any IDs.

Generate the monthly ticket assignments now.
"""


class TicketAssignment(BaseModel):
    """Schema for a single ticket assignment"""

    chore_id: str = Field(description="The ID of the chore (must match one of the provided chore IDs exactly)")
    assigned_user_id: str = Field(
        description="The ID of the user assigned to this ticket (must match one of the provided user IDs exactly)"
    )
    due_date: str = Field(description="Due date in format YYYY-MM-DD")


class MonthlyTicketsResponse(BaseModel):
    """Schema for the complete response from Gemini"""

    tickets: List[TicketAssignment] = Field(
        description="List of monthly ticket assignments"
    )


def generate_monthly_tickets(db: Session, house_id: str) -> Dict[str, Any]:
    """
    Generate monthly tickets for all chores in a house using Gemini AI.
    Uses user preferences and chore data to create fair assignments.
    """
    # 1. Get house information
    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        return {"status": "error", "message": "House not found"}

    # 2. Get all users in the house
    users = db.query(User).filter(User.house_id == house_id).all()
    if not users:
        return {"status": "error", "message": "No users found in the house"}

    # 3. Get all chores for the house
    chores = db.query(Chore).filter(Chore.house_id == house_id).all()
    if not chores:
        return {"status": "error", "message": "No chores found for this house"}

    # Build lookup sets for fast validation of LLM output
    valid_chore_ids = {str(c.id) for c in chores}
    valid_user_ids  = {str(u.id) for u in users}

    # 4. Build user list string
    user_list_parts = []
    for user in users:
        user_list_parts.append(f"- {user.name} (ID: {user.id})")
    user_list_str = "\n".join(user_list_parts)

    # 5. Build user preferences string
    user_preferences_parts = []
    for user in users:
        preferences = (
            db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
        )
        pref_str = f"\n{user.name} (ID: {user.id}):\n"
        if preferences:
            pref_str += f"  - Cleanliness Level: {preferences.cleanliness_level}/5\n"
            pref_str += f"  - Time Availability: {', '.join(preferences.time_availability or []) or 'Not specified'}\n"
            pref_str += f"  - Day Availability: {', '.join(preferences.day_availability or []) or 'Not specified'}\n"
            if preferences.special_requirements:
                pref_str += (
                    f"  - Special Requirements: {preferences.special_requirements}\n"
                )
        else:
            pref_str += "  - No preferences set\n"
        user_preferences_parts.append(pref_str)
    user_preferences_str = "\n".join(user_preferences_parts)

    # 6. Build chores string
    chores_parts = []
    for chore in chores:
        chore_str = f"- {chore.name} (ID: {chore.id})\n"
        chore_str += f"  Frequency: {chore.chore_frequency}\n"
        chore_str += f"  Duration: {chore.duration} minutes\n"
        chore_str += f"  Difficulty: {chore.difficulty_level}/3\n"
        chore_str += f"  Priority: {chore.chore_priority}/3\n"
        if chore.description:
            chore_str += f"  Description: {chore.description}\n"
        chores_parts.append(chore_str)
    chores_str = "\n".join(chores_parts)

    # 7. Calculate month start date
    month_start_date = datetime.now().replace(day=1).strftime("%Y-%m-%d")

    # 8. Format the complete prompt
    prompt = PROMPT_TEMPLATE.format(
        user_list_str=user_list_str,
        user_preferences_str=user_preferences_str,
        chores_str=chores_str,
        month_start_date=month_start_date,
    )

    # 9. Get or create Gemini client
    try:
        client = get_gemini_client()
    except ValueError as e:
        return {"status": "error", "message": str(e)}

    try:
        # 10. Generate content with structured output
        # NOTE: thinking_config is NOT supported on gemini-2.5-flash for JSON output mode
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=MonthlyTicketsResponse.model_json_schema(),
            ),
        )

        # 11. Parse and validate the response
        generated_data = MonthlyTicketsResponse.model_validate_json(response.text)
        print(f"[generate_monthly_tickets] AI returned {len(generated_data.tickets)} assignments")

        # 12. Create tickets in the database
        created_tickets = []
        skipped = 0
        for ticket_assignment in generated_data.tickets:
            chore_id = str(ticket_assignment.chore_id)
            user_id  = str(ticket_assignment.assigned_user_id)

            # Strictly validate the IDs returned by the LLM — hallucinated IDs must be rejected
            if chore_id not in valid_chore_ids:
                print(f"[generate_monthly_tickets] Skipping unknown chore_id: {chore_id}")
                skipped += 1
                continue
            if user_id not in valid_user_ids:
                print(f"[generate_monthly_tickets] Skipping unknown user_id: {user_id}")
                skipped += 1
                continue

            # Parse due_date — convert date → datetime for PostgreSQL DateTime column
            try:
                due_date = datetime.strptime(ticket_assignment.due_date, "%Y-%m-%d")
            except ValueError:
                print(f"[generate_monthly_tickets] Bad date format: {ticket_assignment.due_date}")
                skipped += 1
                continue

            new_ticket = Ticket(
                chore_id=chore_id,
                assigned_user_id=user_id,
                status="Pending",
                due_date=due_date,  # datetime, not date — matches Column(DateTime)
            )
            db.add(new_ticket)
            created_tickets.append(new_ticket)

        # 13. Commit all tickets at once
        db.commit()

        # 14. Refresh all tickets to get their IDs
        for ticket in created_tickets:
            db.refresh(ticket)

        print(f"[generate_monthly_tickets] Created {len(created_tickets)}, skipped {skipped}")

        return {
            "status": "success",
            "tickets_created": len(created_tickets),
            "tickets_skipped": skipped,
            "ticket_ids": [str(ticket.id) for ticket in created_tickets],
        }

    except ValidationError as e:
        return {"status": "error", "message": f"Failed to parse AI response: {str(e)}"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": f"Failed to generate tickets: {str(e)}"}
