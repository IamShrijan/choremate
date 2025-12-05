import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Users as UsersIcon } from "lucide-react";
import { choresAPI, userAPI } from "../utils/api";
import ChoreDetailModal from "../components/ChoreDetailModal";

export default function HouseholdChoresPage({ onBack }) {
    const [houseChores, setHouseChores] = useState([]);
    const [roommates, setRoommates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedChore, setSelectedChore] = useState(null);

    // Filters
    const [selectedPerson, setSelectedPerson] = useState("all");
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const today = new Date();
        const day = today.getDay(); // 0 is Sunday
        const diff = today.getDate() - day;
        return new Date(today.setDate(diff));
    });

    // Fetch house chores and roommates
    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [choresResponse, roommatesResponse] = await Promise.all([
                choresAPI.getChoresByHouse(),
                userAPI.fetchRoommates()
            ]);

            console.log("House chores:", choresResponse);
            console.log("Roommates:", roommatesResponse);
            setHouseChores(choresResponse);
            setRoommates(roommatesResponse);
        } catch (err) {
            console.error("Error fetching data:", err);
            setError("Failed to load household chores");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Generate week dates
    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + i);
        return date;
    });

    const goToPreviousWeek = () => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() - 7);
        setCurrentWeekStart(newDate);
    };

    const goToNextWeek = () => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() + 7);
        setCurrentWeekStart(newDate);
    };

    const formatDate = (date) => {
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const formatWeekRange = () => {
        const start = formatDate(weekDates[0]);
        const end = formatDate(weekDates[6]);
        return `${start} - ${end}, ${weekDates[0].getFullYear()}`;
    };

    const isToday = (date) => {
        const today = new Date();
        return (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        );
    };

    // Color palette for roommates
    const roommateColors = [
        { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" }, // Blue
        { bg: "#dcfce7", border: "#22c55e", text: "#15803d" }, // Green
        { bg: "#fae8ff", border: "#d946ef", text: "#86198f" }, // Fuchsia
        { bg: "#ffedd5", border: "#f97316", text: "#9a3412" }, // Orange
        { bg: "#f3e8ff", border: "#a855f7", text: "#6b21a8" }, // Purple
        { bg: "#ffe4e6", border: "#f43f5e", text: "#9f1239" }, // Rose
        { bg: "#fef9c3", border: "#eab308", text: "#854d0e" }, // Yellow
        { bg: "#e0f2fe", border: "#0ea5e9", text: "#075985" }, // Sky
    ];

    const getRoommateColor = (name) => {
        if (!name) return { bg: "#f3f4f6", border: "#9ca3af", text: "#374151" }; // Gray for unassigned

        // Find index of roommate in the list to assign consistent color
        const index = roommates.findIndex(r => r.name === name);
        if (index !== -1) {
            return roommateColors[index % roommateColors.length];
        }

        // Fallback using hash of name if not found in list
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return roommateColors[Math.abs(hash) % roommateColors.length];
    };

    // Filter chores
    const getChoresForDate = (date) => {
        return houseChores.filter((chore) => {
            // Date filter
            const choreDate = new Date(chore.dueDate);
            const isSameDate = (
                choreDate.getDate() === date.getDate() &&
                choreDate.getMonth() === date.getMonth() &&
                choreDate.getFullYear() === date.getFullYear()
            );

            if (!isSameDate) return false;

            // Person filter
            if (selectedPerson !== "all") {
                const choreName = (chore.assignedTo || "").toLowerCase().trim();
                const selectedName = selectedPerson.toLowerCase().trim();
                if (choreName !== selectedName) return false;
            }

            return true;
        });
    };

    if (loading) {
        return (
            <div style={{ padding: "32px", textAlign: "center", color: "#6b7280" }}>
                Loading household chores...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: "32px", textAlign: "center", color: "#ef4444" }}>
                {error}
            </div>
        );
    }

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{
                backgroundColor: "white",
                borderBottom: "1px solid #e5e7eb",
                padding: "24px 32px",
            }}>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "16px",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <button
                            onClick={onBack}
                            style={{
                                padding: "8px 16px",
                                backgroundColor: "transparent",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "14px",
                                color: "#374151",
                                fontWeight: "500",
                            }}
                        >
                            ← Back to Dashboard
                        </button>
                        <h2 style={{
                            fontSize: "24px",
                            fontWeight: "600",
                            color: "#111827",
                        }}>
                            Household Schedule
                        </h2>
                    </div>
                </div>

                {/* Controls Row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    {/* Person Filter */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <UsersIcon style={{ width: "16px", height: "16px", color: "#6b7280" }} />
                        <select
                            value={selectedPerson}
                            onChange={(e) => setSelectedPerson(e.target.value)}
                            style={{
                                padding: "8px 12px",
                                border: "1px solid #e5e7eb",
                                borderRadius: "6px",
                                fontSize: "14px",
                                color: "#374151",
                                backgroundColor: "white",
                                cursor: "pointer",
                                minWidth: "150px"
                            }}
                        >
                            <option value="all">All Roommates</option>
                            {roommates.map((roommate) => (
                                <option key={roommate.user_id} value={roommate.name}>
                                    {roommate.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Week Navigation */}
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px"
                    }}>
                        <button
                            onClick={goToPreviousWeek}
                            style={{
                                padding: "8px",
                                backgroundColor: "white",
                                border: "1px solid #e5e7eb",
                                borderRadius: "6px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <ChevronLeft style={{ width: "16px", height: "16px" }} />
                        </button>
                        <h3 style={{
                            fontSize: "16px",
                            fontWeight: "500",
                            color: "#374151",
                            minWidth: "140px",
                            textAlign: "center"
                        }}>
                            {formatWeekRange()}
                        </h3>
                        <button
                            onClick={goToNextWeek}
                            style={{
                                padding: "8px",
                                backgroundColor: "white",
                                border: "1px solid #e5e7eb",
                                borderRadius: "6px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <ChevronRight style={{ width: "16px", height: "16px" }} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div style={{
                flex: 1,
                overflow: "auto",
                padding: "32px",
                backgroundColor: "#f9fafb",
            }}>
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "16px",
                }}>
                    {weekDates.map((date, index) => {
                        const dayChores = getChoresForDate(date);
                        const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
                        const isCurrentDay = isToday(date);

                        return (
                            <div
                                key={index}
                                style={{
                                    minHeight: "200px",
                                    borderRadius: "12px",
                                    border: `2px solid ${isCurrentDay ? "#7c3aed" : "#e5e7eb"}`,
                                    backgroundColor: isCurrentDay ? "#f3e8ff" : "white",
                                }}
                            >
                                <div style={{
                                    padding: "12px",
                                    borderBottom: `1px solid ${isCurrentDay ? "#e9d5ff" : "#e5e7eb"}`,
                                }}>
                                    <div style={{
                                        fontSize: "12px",
                                        color: "#6b7280",
                                        marginBottom: "4px",
                                    }}>
                                        {dayName}
                                    </div>
                                    <div style={{
                                        fontSize: "20px",
                                        fontWeight: "600",
                                        color: isCurrentDay ? "#6b21a8" : "#111827",
                                    }}>
                                        {date.getDate()}
                                    </div>
                                </div>

                                <div style={{
                                    padding: "8px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px",
                                }}>
                                    {dayChores.map((chore) => {
                                        const colors = getRoommateColor(chore.assignedTo);
                                        return (
                                            <button
                                                key={chore.id}
                                                onClick={() => setSelectedChore(chore)}
                                                style={{
                                                    width: "100%",
                                                    textAlign: "left",
                                                    padding: "8px",
                                                    borderRadius: "6px",
                                                    backgroundColor: colors.bg,
                                                    border: `1px solid ${colors.border}`,
                                                    cursor: "pointer",
                                                    transition: "all 0.2s ease",
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.filter = "brightness(0.95)";
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.filter = "none";
                                                }}
                                            >
                                                <div style={{
                                                    fontSize: "12px",
                                                    fontWeight: "600",
                                                    color: "#111827",
                                                    marginBottom: "4px",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    display: "-webkit-box",
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: "vertical",
                                                }}>
                                                    {chore.name}
                                                </div>
                                                <div style={{
                                                    fontSize: "11px",
                                                    color: colors.text,
                                                    fontWeight: "500",
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center"
                                                }}>
                                                    <span>{chore.assignedTo || "Unassigned"}</span>
                                                    <span>{chore.effort || chore.duration || "-"}m</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Chore Detail Modal */}
            {selectedChore && (
                <ChoreDetailModal
                    chore={selectedChore}
                    onClose={() => setSelectedChore(null)}
                    onComplete={null} // Read-only view mostly, or implement complete if needed
                    onRefresh={fetchData}
                />
            )}
        </div>
    );
}
