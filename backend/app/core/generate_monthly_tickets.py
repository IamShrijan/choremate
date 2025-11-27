from datetime import datetime, timedelta


def generate_monthly_tickets(db, house_id: int, year: int, month: int):
    # Get all chores for the house
    chores = db.query(Chore).filter(Chore.house_id == house_id).all()

    start_date = datetime(year, month, 1)
    # Simple logic to find end of month
    if month == 12:
        end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = datetime(year, month + 1, 1) - timedelta(days=1)

    generated_count = 0

    for chore in chores:
        # Determine specific dates based on frequency
        dates_to_assign = []
        current = start_date

        while current <= end_date:
            if chore.chore_frequency == "Daily":
                dates_to_assign.append(current)
                current += timedelta(days=1)
            elif chore.chore_frequency == "Weekly":
                # Create ticket every Monday
                if current.weekday() == 0:
                    dates_to_assign.append(current)
                current += timedelta(days=1)
            elif chore.chore_frequency == "Monthly":
                dates_to_assign.append(start_date)  # 1st of month
                break

        # Create Ticket for each date
        for due_date in dates_to_assign:
            # CALL THE FAIRNESS ALGORITHM
            assigned_user = find_best_user_for_chore(db, house_id, chore, due_date)

            new_ticket = Ticket(
                chore_id=chore.id,
                assigned_user_id=assigned_user.id if assigned_user else None,
                status="Pending",
                due_date=due_date,
            )
            db.add(new_ticket)
            generated_count += 1

    db.commit()
    return {"status": "success", "tickets_created": generated_count}
