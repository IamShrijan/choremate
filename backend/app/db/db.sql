
TABLE HOUSES (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    address VARCHAR(255),
    house_layout VARCHAR(255), --- Stored as a JSON object
        -- bathroom_count INT NOT NULL DEFAULT 0,  -- New Column: Number of bathrooms
        -- kitchen_count INT NOT NULL DEFAULT 1,   -- New Column: Number of kitchens
        -- has_living_room BOOLEAN NOT NULL DEFAULT TRUE, -- New Column: True/False for living room
        -- has_patio BOOLEAN NOT NULL DEFAULT FALSE      -- New Column: True/False for patio
);

TABLE USERS (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(255),
    password VARCHAR(255),
    user_profile VARCHAR(255), --- Stored as a JSON object
    house_id INT,
    FOREIGN KEY (house_id) REFERENCES HOUSES(id)
);

# TODO : Chore preferences for each user preference 
TABLE USER_PREFERENCES (
    id INT PRIMARY KEY,
    cleaniness_level INT, --- 1-5
    time_availability VARCHAR(255), --- "Morning", "Afternoon", "Evening", "Night"
    day_availability VARCHAR(255), --- "Weekday", "Weekend",
    special_requirements VARCHAR(255), --- "No high shelves to reach", "No climbing", "No wet floor", "disabilities"
    chore_preferences VARCHAR(255), --- ["Cleaning", "Maintenance", "Repair"]
    user_id INT,
    FOREIGN KEY (user_id) REFERENCES USERS(id)
)

TABLE CHORES {
    id INT PRIMARY KEY,
    name VARCHAR(255),
    description VARCHAR(255),
    difficulty_level INT, --- 1-5
    duration INT, --- in minutes
    chore_duration INT, --- in minutes,
    chore_frequency VARCHAR(255), --- "Daily", "Weekly", "Monthly", "One-time"
    chore_priority INT, --- 1-3 low medium high
    notes VARCHAR(255),
    house_id INT
    FOREIGN KEY (house_id) REFERENCES HOUSES(id)
}

TABLE TICKETS {
    id INT PRIMARY KEY,
    chore_id INT
    FOREIGN KEY (chore_id) REFERENCES CHORES(id),
    assigned_user INT
    FOREIGN KEY (user_id) REFERENCES USERS(id),
    created_user INT
    FOREIGN KEY (created_user) REFERENCES USERS(id),
    status VARCHAR(255), --- "Pending", "Completed", "Cancelled",
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    completed_at TIMESTAMP NULL
}

TABLE Appreciation{
    id INT PRIMARY KEY,
    ticket_id INT
    FOREIGN KEY (ticket_id) REFERENCES TICKETS(id),
    appreciated_by INT
    FOREIGN KEY (appreciated_by) REFERENCES USERS(id),
    message VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
}