import React, { useState } from "react";
import { Sparkles, Users, Home } from "lucide-react";
import { Card, CardContent } from "../components/card";

export default function HouseholdSelection({ onCreateHousehold = () => { }, onJoinHousehold = () => { } }) {
    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(to bottom right, #faf5ff, #faf5ff, #f3e8ff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            fontFamily: "system-ui, -apple-system, sans-serif"
        }}>
            <div style={{ width: "100%", maxWidth: "896px" }}>
                {/* Logo and Welcome */}
                <div style={{ textAlign: "center", marginBottom: "32px" }}>
                    <div style={{
                        width: "64px",
                        height: "64px",
                        background: "linear-gradient(to bottom right, #fb923c, #ec4899)",
                        borderRadius: "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 16px",
                        boxShadow: "0 10px 15px rgba(0, 0, 0, 0.1)"
                    }}>
                        <Sparkles style={{ width: "32px", height: "32px", color: "white" }} />
                    </div>
                    <h1 style={{
                        fontSize: "32px",
                        fontWeight: "bold",
                        color: "#111827",
                        marginBottom: "8px",
                        lineHeight: "1.2"
                    }}>
                        Welcome to <span style={{
                            background: "linear-gradient(to right, #f97316, #ec4899)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            backgroundClip: "text"
                        }}>ChoreMate</span>
                    </h1>
                    <p style={{
                        color: "#6b7280",
                        fontSize: "16px",
                        lineHeight: "1.6"
                    }}>
                        Making household chores collaborative, fair, and actually enjoyable for shared living spaces
                    </p>
                </div>

                {/* Feature Cards */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                    gap: "16px",
                    marginBottom: "32px"
                }}>
                    <Card>
                        <CardContent style={{ padding: "24px", textAlign: "center" }}>
                            <div style={{
                                width: "64px",
                                height: "64px",
                                background: "linear-gradient(to bottom right, #fb923c, #f97316)",
                                borderRadius: "16px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 12px"
                            }}>
                                <Sparkles style={{ width: "32px", height: "32px", color: "white" }} />
                            </div>
                            <p style={{
                                color: "#111827",
                                fontSize: "16px",
                                fontWeight: "600",
                                marginBottom: "8px"
                            }}>Fair Distribution</p>
                            <p style={{
                                color: "#6b7280",
                                fontSize: "12px",
                                lineHeight: "1.5"
                            }}>
                                AI-powered scheduling that respects everyone's preferences
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent style={{ padding: "24px", textAlign: "center" }}>
                            <div style={{
                                width: "64px",
                                height: "64px",
                                background: "linear-gradient(to bottom right, #22d3ee, #06b6d4)",
                                borderRadius: "16px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 12px"
                            }}>
                                <Sparkles style={{ width: "32px", height: "32px", color: "white" }} />
                            </div>
                            <p style={{
                                color: "#111827",
                                fontSize: "16px",
                                fontWeight: "600",
                                marginBottom: "8px"
                            }}>Flexible Schedules</p>
                            <p style={{
                                color: "#6b7280",
                                fontSize: "12px",
                                lineHeight: "1.5"
                            }}>
                                Swap, reschedule, and delegate tasks naturally
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent style={{ padding: "24px", textAlign: "center" }}>
                            <div style={{
                                width: "64px",
                                height: "64px",
                                background: "linear-gradient(to bottom right, #f472b6, #ec4899)",
                                borderRadius: "16px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 12px"
                            }}>
                                <Sparkles style={{ width: "32px", height: "32px", color: "white" }} />
                            </div>
                            <p style={{
                                color: "#111827",
                                fontSize: "16px",
                                fontWeight: "600",
                                marginBottom: "8px"
                            }}>Zero Nagging</p>
                            <p style={{
                                color: "#6b7280",
                                fontSize: "12px",
                                lineHeight: "1.5"
                            }}>
                                Gentle reminders and celebrations, not demands
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Household Options */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "16px",
                    maxWidth: "672px",
                    margin: "0 auto"
                }}>
                    <GradientButton onClick={onCreateHousehold}>
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "12px",
                            width: "100%"
                        }}>
                            <div style={{
                                width: "48px",
                                height: "48px",
                                backgroundColor: "rgba(255, 255, 255, 0.2)",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                            }}>
                                <Home style={{ width: "24px", height: "24px", color: "white" }} />
                            </div>
                            <div>
                                <p style={{
                                    fontSize: "16px",
                                    fontWeight: "600",
                                    marginBottom: "4px"
                                }}>Create Household</p>
                                <p style={{
                                    fontSize: "12px",
                                    opacity: 0.9
                                }}>
                                    Set up a new shared living space
                                </p>
                            </div>
                        </div>
                    </GradientButton>

                    <OutlineButton onClick={onJoinHousehold}>
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "12px",
                            width: "100%"
                        }}>
                            <div style={{
                                width: "48px",
                                height: "48px",
                                backgroundColor: "#f3e8ff",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                            }}>
                                <Users style={{ width: "24px", height: "24px", color: "#7c3aed" }} />
                            </div>
                            <div>
                                <p style={{
                                    fontSize: "16px",
                                    fontWeight: "600",
                                    marginBottom: "4px",
                                    color: "#111827"
                                }}>Join Existing Household</p>
                                <p style={{
                                    fontSize: "12px",
                                    color: "#6b7280"
                                }}>
                                    Have an invite code? Join your roommates
                                </p>
                            </div>
                        </div>
                    </OutlineButton>
                </div>

                <p style={{
                    textAlign: "center",
                    color: "#6b7280",
                    fontSize: "12px",
                    marginTop: "32px"
                }}>
                    Perfect for roommates, graduate students, and shared living spaces
                </p>
            </div>
        </div>
    );
}

// Custom Gradient Button Component
function GradientButton({ onClick, children, style }) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                height: "auto",
                padding: "24px 32px",
                background: isHovered
                    ? "linear-gradient(to right, #ea580c, #db2777)"
                    : "linear-gradient(to right, #f97316, #ec4899)",
                color: "white",
                boxShadow: "0 10px 15px rgba(0, 0, 0, 0.1)",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontSize: "14px",
                fontWeight: "600",
                ...style
            }}
        >
            {children}
        </button>
    );
}

// Custom Outline Button Component
function OutlineButton({ onClick, children, style }) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                height: "auto",
                padding: "24px 32px",
                backgroundColor: isHovered ? "#faf5ff" : "white",
                border: "2px solid #d8b4fe",
                color: "#111827",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontSize: "14px",
                fontWeight: "600",
                ...style
            }}
        >
            {children}
        </button>
    );
}