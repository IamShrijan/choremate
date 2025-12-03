import React, { useState, useEffect } from "react";
import { Users, Trophy, Star, ArrowLeft } from "lucide-react";
import { statsAPI, userAPI, houseAPI } from "../utils/api";

export default function RoommatesPage({ onBack }) {
    const [fairnessData, setFairnessData] = useState([]);
    const [roommates, setRoommates] = useState([]);  // Now will hold leaderboard data
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [currentUser, setCurrentUser] = useState(null);
    const [totalHouseholdMinutes, setTotalHouseholdMinutes] = useState(0);

    // Fetch fairness report and leaderboard data
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                
                // Get current user info
                const userInfo = await userAPI.getMe();
                setCurrentUser(userInfo);
                
                // Fetch fairness report
                const fairnessReport = await statsAPI.getFairnessReport();
                
                if (fairnessReport.status === "success") {
                    setTotalHouseholdMinutes(fairnessReport.total_household_minutes || 0);
                    
                    const transformed = fairnessReport.user_contributions.map((user) => ({
                        user_id: user.user_id,
                        name: user.user_name,
                        totalPlannedMinutes: user.total_planned_minutes || 0,
                        choreCount: user.chore_count || 0,
                    }));
                    
                    transformed.sort((a, b) => b.totalPlannedMinutes - a.totalPlannedMinutes);
                    setFairnessData(transformed);
                }

                // Fetch leaderboard
                const leaderboardResponse = await statsAPI.getLeaderboard();
                
                if (leaderboardResponse.status === "success") {
                    setRoommates(leaderboardResponse.leaderboard.map((entry) => ({
                        id: entry.user_id,
                        name: entry.user_name,
                        email: entry.email || "",
                        totalTasks: entry.total_tasks,
                        completedTasks: entry.completed_tasks,
                        rating: entry.rating,
                        rank: entry.rank,
                    })));
                }
            } catch (err) {
                console.error("Failed to fetch data:", err);
                setError(err.message || "Failed to load data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        
        // Poll every 10 seconds for live updates
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    // Use total household minutes as max scale (ensure minimum of 1 to prevent division by zero)
    const maxScale = Math.max(totalHouseholdMinutes, 1);

    // Update renderStars to use the actual rating value
    const renderStars = (rating) => {
        const roundedRating = Math.round(rating);  // Round to nearest integer for star display
        return (
            <div style={{ display: "flex", gap: "4px" }}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        style={{
                            width: "20px",
                            height: "20px",
                            fill: star <= roundedRating ? "#7c3aed" : "#d1d5db",
                            color: star <= roundedRating ? "#7c3aed" : "#d1d5db",
                        }}
                    />
                ))}
            </div>
        );
    };

    const getRankBadge = (rank) => {
        const badges = {
            1: { bg: "#fef3c7", text: "#92400e", icon: "🥇" },
            2: { bg: "#e5e7eb", text: "#1f2937", icon: "🥈" },
            3: { bg: "#fed7aa", text: "#9a3412", icon: "🥉" },
        };

        const badge = badges[rank] || { bg: "#f3e8ff", text: "#6b21a8", icon: rank };

        return (
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: badge.bg,
                fontSize: "20px",
            }}>
                {badge.icon}
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#f9fafb",
            }}>
                <p style={{ color: "#6b7280" }}>Loading fairness report...</p>
            </div>
        );
    }

    return (
        <div style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#f9fafb",
        }}>
            {/* Header */}
            <div style={{
                backgroundColor: "white",
                borderBottom: "1px solid #e5e7eb",
                padding: "16px 32px",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <button
                        onClick={onBack}
                        style={{
                            padding: "8px",
                            backgroundColor: "transparent",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <ArrowLeft style={{ width: "20px", height: "20px" }} />
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <Users style={{ width: "24px", height: "24px", color: "#7c3aed" }} />
                        <h2 style={{
                            fontSize: "24px",
                            fontWeight: "600",
                            color: "#111827",
                        }}>
                            Roommates & Leaderboard
                        </h2>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{
                flex: 1,
                overflow: "auto",
                padding: "32px",
            }}>
                {error && (
                    <div style={{
                        padding: "12px",
                        backgroundColor: "#fee2e2",
                        color: "#b91c1c",
                        borderRadius: "6px",
                        marginBottom: "20px",
                        fontSize: "14px"
                    }}>
                        {error}
                    </div>
                )}

                {/* Fairness Report Section */}
                <div style={{
                    backgroundColor: "white",
                    borderRadius: "12px",
                    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                    border: "1px solid #e5e7eb",
                    padding: "24px",
                    marginBottom: "24px",
                }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "24px",
                    }}>
                        <Trophy style={{ width: "24px", height: "24px", color: "#7c3aed" }} />
                        <h3 style={{
                            fontSize: "20px",
                            fontWeight: "600",
                            color: "#111827",
                        }}>
                            Fairness Report
                        </h3>
                    </div>

                    {/* Custom Bar Chart */}
                    <div style={{ marginBottom: "16px" }}>
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "20px",
                        }}>
                            {fairnessData.map((person) => {
                                // Calculate bar width as percentage of total household minutes
                                const barPercent = (person.totalPlannedMinutes / maxScale) * 100;
                                // Calculate percentage of total household effort
                                const effortPercentage = maxScale > 0 
                                    ? ((person.totalPlannedMinutes / maxScale) * 100).toFixed(1)
                                    : "0.0";
                                
                                return (
                                    <div key={person.user_id}>
                                        <div style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            marginBottom: "8px",
                                        }}>
                                            <span style={{
                                                fontSize: "14px",
                                                fontWeight: "500",
                                                color: "#374151",
                                            }}>
                                                {person.name === currentUser?.name ? "You" : person.name}
                                            </span>
                                        </div>
                                        <div style={{
                                            position: "relative",
                                            width: "100%",
                                            height: "40px",
                                            backgroundColor: "#f3f4f6",
                                            borderRadius: "8px",
                                            overflow: "visible",
                                        }}>
                                            {/* Purple bar showing assigned effort for this person */}
                                            <div style={{
                                                width: `${barPercent}%`,
                                                height: "100%",
                                                backgroundColor: "#7c3aed",
                                                borderRadius: "8px",
                                                transition: "width 0.3s ease",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "flex-end",
                                                paddingRight: "8px",
                                                minWidth: "60px",  // Minimum width to show percentage
                                            }}>
                                                <span style={{
                                                    fontSize: "12px",
                                                    fontWeight: "600",
                                                    color: "white",
                                                }}>
                                                    {effortPercentage}%
                                                </span>
                                            </div>
                                            
                                            {/* Chore count label at the end of the bar */}
                                            <div style={{
                                                position: "absolute",
                                                left: `${barPercent}%`,
                                                marginLeft: "12px",
                                                height: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                whiteSpace: "nowrap",
                                            }}>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Description of how fairness is calculated */}
                    <div style={{
                        padding: "16px",
                        backgroundColor: "#f9fafb",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        marginBottom: "16px",
                    }}>
                        <p style={{
                            fontSize: "13px",
                            color: "#4b5563",
                            lineHeight: "1.5",
                            margin: 0,
                        }}>
                            <strong style={{ color: "#111827" }}>How Fairness is Calculated:</strong>{" "}
                            The percentage represents each person's share of the total monthly effort based on chore durations. 
                            The purple bar shows the assigned effort in minutes relative to the household total. 
                            A balanced distribution means similar percentages across all members.
                        </p>
                    </div>
                </div>

                {/* Leaderboard Section */}
                <div style={{
                    backgroundColor: "white",
                    borderRadius: "12px",
                    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                    border: "1px solid #e5e7eb",
                    padding: "24px",
                }}>
                    <h3 style={{
                        fontSize: "20px",
                        fontWeight: "600",
                        color: "#111827",
                        marginBottom: "24px",
                    }}>
                        Leaderboard
                    </h3>

                    {/* Description of how leaderboard is calculated */}
                    <div style={{
                        padding: "16px",
                        backgroundColor: "#f9fafb",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        marginBottom: "24px",
                    }}>
                        <p style={{
                            fontSize: "13px",
                            color: "#4b5563",
                            lineHeight: "1.5",
                            margin: 0,
                        }}>
                            <strong style={{ color: "#111827" }}>How Leaderboard is Calculated:</strong>{" "}
                            Each person's rating is calculated as (completed tasks ÷ total tasks assigned this week) × 5, 
                            giving a score out of 5 stars. The leaderboard is ordered by highest rating first. 
                            This shows who has completed the highest percentage of their assigned chores this week (Sunday to Saturday).
                        </p>
                    </div>

                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                    }}>
                        {roommates.map((roommate) => (
                            <div
                                key={roommate.id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "16px",
                                    padding: "16px",
                                    borderRadius: "12px",
                                    border: "1px solid #e5e7eb",
                                    transition: "border-color 0.2s ease",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = "#c4b5fd";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = "#e5e7eb";
                                }}
                            >
                                {/* Rank Badge */}
                                <div style={{ flexShrink: 0 }}>
                                    {getRankBadge(roommate.rank)}
                                </div>

                                {/* Avatar Placeholder */}
                                <div style={{
                                    width: "56px",
                                    height: "56px",
                                    borderRadius: "50%",
                                    backgroundColor: "#e5e7eb",
                                    flexShrink: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "24px",
                                    fontWeight: "600",
                                    color: "#6b7280",
                                }}>
                                    {roommate.name.charAt(0).toUpperCase()}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        marginBottom: "4px",
                                    }}>
                                        <p style={{
                                            fontSize: "16px",
                                            fontWeight: "600",
                                            color: "#111827",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}>
                                            {roommate.name}
                                        </p>
                                        {roommate.name === currentUser?.name && (
                                            <span style={{
                                                padding: "2px 8px",
                                                backgroundColor: "#f3e8ff",
                                                color: "#6b21a8",
                                                borderRadius: "12px",
                                                fontSize: "12px",
                                                fontWeight: "600",
                                            }}>
                                                You
                                            </span>
                                        )}
                                    </div>
                                    {roommate.email && (
                                        <p style={{
                                            fontSize: "14px",
                                            color: "#6b7280",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}>
                                            {roommate.email}
                                        </p>
                                    )}
                                </div>

                                {/* Stats */}
                                <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "flex-end",
                                    gap: "4px",
                                    flexShrink: 0,
                                }}>
                                    <span style={{
                                        fontSize: "14px",
                                        color: "#6b7280",
                                    }}>
                                        {roommate.completedTasks}/{roommate.totalTasks} tasks
                                    </span>
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                    }}>
                                        {renderStars(roommate.rating)}
                                        <span style={{
                                            fontSize: "12px",
                                            color: "#6b7280",
                                            fontWeight: "500",
                                        }}>
                                            {roommate.rating.toFixed(1)}/5
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
