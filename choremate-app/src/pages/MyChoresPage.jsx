import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import ChoreDetailModal from "../components/ChoreDetailModal";
import AddChoreModal from "../components/AddChoreModal";

export default function MyChoresPage({ onBack, allChores = [], onAddChore, onCompleteChore, completedChores = [] }) {
    const [selectedChore, setSelectedChore] = useState(null);
    const [showAddChore, setShowAddChore] = useState(false);
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day;
        return new Date(today.setDate(diff));
    });

    // Filter out completed chores
    const myChores = allChores.filter(chore => !completedChores.includes(chore.id));

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

    const getChoresForDate = (date) => {
        return myChores.filter((chore) => {
            const choreDate = new Date(chore.dueDate);
            return (
                choreDate.getDate() === date.getDate() &&
                choreDate.getMonth() === date.getMonth() &&
                choreDate.getFullYear() === date.getFullYear()
            );
        });
    };

    const isToday = (date) => {
        const today = new Date();
        return (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        );
    };

    const priorityColors = {
        high: "#ef4444",
        medium: "#f59e0b",
        low: "#3b82f6",
    };

    const formatDate = (date) => {
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const formatWeekRange = () => {
        const start = formatDate(weekDates[0]);
        const end = formatDate(weekDates[6]);
        return `${start} - ${end}, ${weekDates[0].getFullYear()}`;
    };

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
                            My Chores
                        </h2>
                    </div>
                    <button
                        onClick={() => setShowAddChore(true)}
                        style={{
                            padding: "10px 16px",
                            backgroundColor: "#7c3aed",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "14px",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                        }}
                    >
                        <Plus style={{ width: "16px", height: "16px" }} />
                        Add Chore
                    </button>
                </div>

                {/* Week Navigation */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
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
                                    {dayChores.map((chore) => (
                                        <button
                                            key={chore.id}
                                            onClick={() => setSelectedChore(chore)}
                                            style={{
                                                width: "100%",
                                                textAlign: "left",
                                                padding: "8px",
                                                borderRadius: "6px",
                                                borderLeft: `4px solid ${priorityColors[chore.priority]}`,
                                                backgroundColor: "#f9fafb",
                                                border: "1px solid #e5e7eb",
                                                borderLeftWidth: "4px",
                                                borderLeftColor: priorityColors[chore.priority],
                                                cursor: "pointer",
                                                transition: "all 0.2s ease",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = "#f3f4f6";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = "#f9fafb";
                                            }}
                                        >
                                            <div style={{
                                                fontSize: "12px",
                                                fontWeight: "500",
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
                                                color: "#6b7280",
                                            }}>
                                                {new Date(chore.dueDate).toLocaleTimeString("en-US", {
                                                    hour: "numeric",
                                                    minute: "2-digit",
                                                })}
                                            </div>
                                            <div style={{
                                                fontSize: "11px",
                                                color: "#6b7280",
                                            }}>
                                                ~{chore.effort}min
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modals */}
            {selectedChore && (
                <ChoreDetailModal
                    chore={selectedChore}
                    onClose={() => setSelectedChore(null)}
                    onComplete={(choreId) => {
                        if (onCompleteChore) {
                            onCompleteChore(choreId);
                        }
                        setSelectedChore(null);
                    }}
                />
            )}

            {showAddChore && (
                <AddChoreModal
                    onClose={() => setShowAddChore(false)}
                    onAdd={onAddChore}
                />
            )}
        </div>
    );
}
