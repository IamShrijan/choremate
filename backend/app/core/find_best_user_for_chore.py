from sqlalchemy import func

from ..models.model import User, Ticket


def find_best_user_for_chore(db_session, house_id, chore, due_date):
    """
    Finds the user with the lowest load who is available.
    """
    # 1. Get all users in the house
    roommates = db_session.query(User).filter(User.house_id == house_id).all()

    candidates = []

    # 2. Filter by Preferences (Hard Constraints)
    day_of_week = due_date.strftime("%A")  # e.g., 'Monday'
    is_weekend = day_of_week in ["Saturday", "Sunday"]

    for user in roommates:
        prefs = user.preferences
        if not prefs:
            candidates.append(user)  # Assume available if no prefs set
            continue

        # Check Day Availability
        if is_weekend and prefs.day_availability == "Weekday":
            continue  # Skip this user

        # Check Special Requirements (Simple keyword matching)
        if (
            prefs.special_requirements
            and "disability" in prefs.special_requirements.lower()
        ):
            if chore.difficulty_level > 3:  # Skip hard chores
                continue

        candidates.append(user)

    # 3. Fairness Logic (Load Balancing)
    # Count 'Pending' tickets for each candidate to find who is free
    best_candidate = None
    min_load = float("inf")

    for candidate in candidates:
        current_load = (
            db_session.query(Ticket)
            .filter(Ticket.assigned_user_id == candidate.id, Ticket.status == "Pending")
            .count()
        )

        # You could also weigh this by 'difficulty_level' sum for better fairness

        if current_load < min_load:
            min_load = current_load
            best_candidate = candidate

    return best_candidate
