import React from "react";
import { Users, Trophy, Star, ArrowLeft } from "lucide-react";

export default function RoommatesPage({ onBack }) {
    // Mock data for fairness chart
    const fairnessData = [
        { name: "You", choresCompleted: 10, color: "#8b5cf6" },
        { name: "John Doe", choresCompleted: 8, color: "#7c3aed" },
        { name: "Jane Doe", choresCompleted: 12, color: "#6d28d9" },
        { name: "Richard Roe", choresCompleted: 10, color: "#5b21b6" },
    ];

    // Mock roommate data with leaderboard info
    const roommates = [
        {
            id: 1,
            name: "Jane Doe",
            email: "jane@email.com",
            avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
            choresCompleted: 12,
            rating: 5,
            rank: 1,
        },
        {
            id: 2,
            name: "Richard Roe",
            email: "richard@email.com",
            avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
            choresCompleted: 10,
            rating: 4,
            rank: 2,
        },
        {
            id: 3,
            name: "You",
            email: "john@email.com",
            avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
            choresCompleted: 10,
            rating: 3,
            rank: 3,
        },
        {
            id: 4,
            name: "John Doe",
            email: "johndoe@email.com",
            avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
            choresCompleted: 8,
            rating: 3,
            rank: 4,
        },
    ];

    const maxChores = Math.max(...fairnessData.map(d => d.choresCompleted));

    const renderStars = (rating) => {
        return (
            <div style={{ display: "flex", gap: "4px" }}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        style={{
                            width: "20px",
                            height: "20px",
                            fill: star <= rating ? "#7c3aed" : "#d1d5db",
                            color: star <= rating ? "#7c3aed" : "#d1d5db",
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
                            gap: "16px",
                        }}>
                            {fairnessData.map((person) => (
                                <div key={person.name}>
                                    <div style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginBottom: "8px",
                                    }}>
                                        <span style={{
                                            fontSize: "14px",
                                            fontWeight: "500",
                                            color: "#374151",
                                        }}>
                                            {person.name}
                                        </span>
                                        <span style={{
                                            fontSize: "14px",
                                            fontWeight: "600",
                                            color: "#111827",
                                        }}>
                                            {person.choresCompleted} chores
                                        </span>
                                    </div>
                                    <div style={{
                                        width: "100%",
                                        height: "32px",
                                        backgroundColor: "#f3f4f6",
                                        borderRadius: "8px",
                                        overflow: "hidden",
                                    }}>
                                        <div style={{
                                            width: `${(person.choresCompleted / maxChores) * 100}%`,
                                            height: "100%",
                                            backgroundColor: person.color,
                                            borderRadius: "8px",
                                            transition: "width 0.3s ease",
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <p style={{
                        fontSize: "14px",
                        color: "#6b7280",
                        textAlign: "center",
                        marginTop: "16px",
                    }}>
                        Showing chores completed this week across all household members
                    </p>
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

                                {/* Avatar */}
                                <div style={{
                                    width: "56px",
                                    height: "56px",
                                    borderRadius: "50%",
                                    overflow: "hidden",
                                    backgroundColor: "#e5e7eb",
                                    flexShrink: 0,
                                }}>
                                    <img
                                        src={roommate.avatar}
                                        alt={roommate.name}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                        }}
                                    />
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
                                        {roommate.name === "You" && (
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
                                    <p style={{
                                        fontSize: "14px",
                                        color: "#6b7280",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}>
                                        {roommate.email}
                                    </p>
                                </div>

                                {/* Stats */}
                                <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "flex-end",
                                    gap: "4px",
                                    flexShrink: 0,
                                }}>
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                    }}>
                                        <span style={{
                                            fontSize: "14px",
                                            color: "#6b7280",
                                        }}>
                                            {roommate.choresCompleted} chores
                                        </span>
                                    </div>
                                    {renderStars(roommate.rating)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action Button */}
                <div style={{ marginTop: "24px" }}>
                    <button style={{
                        padding: "12px 24px",
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
                    }}>
                        <Users style={{ width: "16px", height: "16px" }} />
                        Invite New Roommate
                    </button>
                </div>
            </div>
        </div>
    );
}
