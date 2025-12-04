import React, { useState, useEffect } from "react";
import { ChevronLeft, Calendar, Users as UsersIcon } from "lucide-react";
import { choresAPI, userAPI } from "../utils/api";

export default function HouseholdChoresPage({ onBack }) {
    const [houseChores, setHouseChores] = useState([]);
    const [roommates, setRoommates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [selectedPerson, setSelectedPerson] = useState("all");
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        return today.toISOString().split("T")[0];
    });

    // Fetch house chores and roommates
    useEffect(() => {
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

        fetchData();
    }, []);

    // Filter chores based on selected person and date
    const filteredChores = houseChores.filter(chore => {
        // Filter by person - now using name directly
        if (selectedPerson !== "all") {
            // Normalize names for comparison (case-insensitive, trim whitespace)
            const choreName = (chore.assignedTo || "").toLowerCase().trim();
            const selectedName = selectedPerson.toLowerCase().trim();

            if (choreName !== selectedName) {
                return false;
            }
        }

        // Filter by date
        const choreDate = new Date(chore.dueDate);
        const filterDate = new Date(selectedDate);

        return (
            choreDate.getDate() === filterDate.getDate() &&
            choreDate.getMonth() === filterDate.getMonth() &&
            choreDate.getFullYear() === filterDate.getFullYear()
        );
    });

    const priorityColors = {
        1: "#3b82f6", // low - blue
        2: "#f59e0b", // medium - yellow
        3: "#ef4444", // high - red
    };

    const statusColors = {
        "Completed": { bg: "#d1fae5", text: "#065f46" },
        "In Progress": { bg: "#fef3c7", text: "#92400e" },
        "Pending": { bg: "#fee2e2", text: "#991b1b" },
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
                            Household Chores
                        </h2>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
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
                            }}
                        >
                            <option value="all">All People</option>
                            {roommates.map((roommate) => (
                                <option key={roommate.user_id} value={roommate.name}>
                                    {roommate.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date Filter */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Calendar style={{ width: "16px", height: "16px", color: "#6b7280" }} />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            style={{
                                padding: "8px 12px",
                                border: "1px solid #e5e7eb",
                                borderRadius: "6px",
                                fontSize: "14px",
                                color: "#374151",
                                backgroundColor: "white",
                                cursor: "pointer",
                            }}
                        />
                    </div>

                    {/* Results count */}
                    <div style={{
                        marginLeft: "auto",
                        fontSize: "14px",
                        color: "#6b7280",
                    }}>
                        {filteredChores.length} chore{filteredChores.length !== 1 ? 's' : ''}
                    </div>
                </div>
            </div>

            {/* Chores Table */}
            <div style={{
                flex: 1,
                overflow: "auto",
                padding: "32px",
                backgroundColor: "#f9fafb",
            }}>
                <div style={{
                    backgroundColor: "white",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    overflow: "hidden",
                }}>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
                                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Chore</th>
                                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Assignee</th>
                                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Due Time</th>
                                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Priority</th>
                                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Status</th>
                                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Effort</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredChores.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: "32px", textAlign: "center", color: "#6b7280" }}>
                                            No chores found for the selected filters
                                        </td>
                                    </tr>
                                ) : (
                                    filteredChores.map((chore, index) => (
                                        <tr key={index} style={{ borderBottom: "1px solid #e5e7eb" }}>
                                            <td style={{ padding: "16px", fontSize: "14px", color: "#111827", fontWeight: "500" }}>
                                                {chore.name}
                                            </td>
                                            <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280" }}>
                                                {chore.assignedTo || "Unassigned"}
                                            </td>
                                            <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280" }}>
                                                {chore.dueDate ? new Date(chore.dueDate).toLocaleTimeString("en-US", {
                                                    hour: "numeric",
                                                    minute: "2-digit"
                                                }) : "No time"}
                                            </td>
                                            <td style={{ padding: "16px" }}>
                                                <div style={{
                                                    width: "8px",
                                                    height: "8px",
                                                    borderRadius: "50%",
                                                    backgroundColor: priorityColors[chore.priority] || priorityColors[2]
                                                }} />
                                            </td>
                                            <td style={{ padding: "16px" }}>
                                                <span style={{
                                                    padding: "4px 12px",
                                                    borderRadius: "12px",
                                                    fontSize: "12px",
                                                    fontWeight: "500",
                                                    backgroundColor: statusColors[chore.status]?.bg || statusColors["Pending"].bg,
                                                    color: statusColors[chore.status]?.text || statusColors["Pending"].text
                                                }}>
                                                    {chore.status || "Pending"}
                                                </span>
                                            </td>
                                            <td style={{ padding: "16px", fontSize: "14px", color: "#6b7280" }}>
                                                {chore.effort || chore.duration || "-"} min
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
