// choremate-app/src/pages/waitingForRoomatePage.jsx
import { Sparkles, Check, Clock, Copy } from "lucide-react";
import Button from "../components/button";
import { Card, CardContent } from "../components/card";
import { useState, useEffect } from "react";
import { houseAPI } from "../utils/api";

export default function WaitingForRoommatesPage({
    inviteCode, // Can be undefined now
    roommates: initialRoommates, // Optional
    onContinue = () => { },
}) {
    const [copied, setCopied] = useState(false);
    const [membersStatus, setMembersStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Fetch members status periodically
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const status = await houseAPI.getMembersStatus();
                setMembersStatus(status);
                
                // Convert to the format expected by the component
                const formattedRoommates = status.members.map(member => ({
                    id: member.user_id || member.email,
                    emailOrPhone: member.email,
                    name: member.name,
                    completed: member.preferences_completed,
                }));
                
                // Update roommates if we have initial data
                if (initialRoommates) {
                    // Merge with initial roommates to preserve order
                    const merged = initialRoommates.map(rm => {
                        const found = formattedRoommates.find(
                            fr => fr.emailOrPhone === rm.emailOrPhone
                        );
                        return found || rm;
                    });
                    setMembersStatus(prev => ({
                        ...prev,
                        members: merged.map(rm => ({
                            user_id: rm.id,
                            name: rm.name,
                            email: rm.emailOrPhone,
                            has_joined: true,
                            preferences_completed: rm.completed || false,
                        })),
                    }));
                }
            } catch (err) {
                setError(err.message || "Failed to fetch status");
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
        
        // Poll every 5 seconds to check for updates
        const interval = setInterval(fetchStatus, 5000);
        
        return () => clearInterval(interval);
    }, [inviteCode, initialRoommates]);

    const handleCopyCode = () => {
        const code = membersStatus?.invite_code || inviteCode;
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading && !membersStatus) {
        return (
            <div style={{
                minHeight: "100vh",
                background: "linear-gradient(to bottom right, #faf5ff, #f3e8ff)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}>
                <p style={{ color: "#6b7280" }}>Loading...</p>
            </div>
        );
    }

    const members = membersStatus?.members || [];

    // Count EVERY row we show (joined + invited)
    const totalCount = members.length;
    const completedCount = members.filter(m => m.preferences_completed).length;

    // Only "Everyone's Ready" when EVERY row has preferences_completed === true
    const allCompleted = totalCount > 0 && completedCount === totalCount;

    const displayInviteCode = membersStatus?.invite_code || inviteCode;

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(to bottom right, #faf5ff, #f3e8ff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
        }}>
            <div style={{ width: "100%", maxWidth: "672px" }}>
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: "32px" }}>
                    <div style={{
                        width: "64px",
                        height: "64px",
                        background: "linear-gradient(to bottom right, #7c3aed, #6d28d9)",
                        borderRadius: "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 16px",
                        boxShadow: "0 10px 15px rgba(0, 0, 0, 0.1)",
                    }}>
                        <Sparkles style={{ width: "32px", height: "32px", color: "white" }} />
                    </div>
                    <h1 style={{
                        color: "#111827",
                        marginBottom: "8px",
                        fontSize: "28px",
                        fontWeight: "600",
                    }}>
                        {allCompleted ? "Everyone's Ready!" : "Waiting for Everyone to Complete Survey"}
                    </h1>
                    <p style={{ color: "#6b7280", fontSize: "16px" }}>
                        {allCompleted
                            ? "All roommates have completed their surveys"
                            : "Once everyone completes their preferences, you can generate the schedule"}
                    </p>
                </div>

                {/* Error message */}
                {error && (
                    <div style={{
                        padding: "12px",
                        backgroundColor: "#fee2e2",
                        color: "#dc2626",
                        borderRadius: "6px",
                        marginBottom: "20px",
                        fontSize: "14px"
                    }}>
                        {error}
                    </div>
                )}

                {/* Progress Card */}
                <Card style={{
                    borderColor: "#e9d5ff",
                    boxShadow: "0 20px 25px rgba(0, 0, 0, 0.1)",
                    marginBottom: "24px",
                }}>
                    <CardContent style={{ padding: "32px" }}>
                        <div style={{ textAlign: "center", marginBottom: "24px" }}>
                            <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "96px",
                                height: "96px",
                                backgroundColor: "#f3e8ff",
                                borderRadius: "50%",
                                marginBottom: "16px",
                            }}>
                                {allCompleted ? (
                                    <Check style={{ width: "48px", height: "48px", color: "#16a34a" }} />
                                ) : (
                                    <Clock style={{
                                        width: "48px",
                                        height: "48px",
                                        color: "#7c3aed",
                                        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                                    }} />
                                )}
                            </div>
                            <p style={{
                                color: "#111827",
                                marginBottom: "4px",
                                fontSize: "16px",
                                fontWeight: "600",
                            }}>
                                Survey Progress
                            </p>
                            <p style={{ color: "#6b7280", fontSize: "14px" }}>
                                {completedCount} of {totalCount} roommates completed
                            </p>
                        </div>

                        {/* Progress Bar */}
                        <div style={{
                            width: "100%",
                            backgroundColor: "#e5e7eb",
                            borderRadius: "9999px",
                            height: "12px",
                            marginBottom: "24px",
                            overflow: "hidden",
                        }}>
                            <div style={{
                                background: "linear-gradient(to right, #a855f7, #7c3aed)",
                                height: "12px",
                                borderRadius: "9999px",
                                transition: "width 0.5s ease",
                                width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                            }} />
                        </div>

                        {/* Roommate List */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {members.map((member, index) => (
                                <div
                                    key={member.user_id || member.email || index}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "16px",
                                        borderRadius: "8px",
                                        border: member.preferences_completed ? "1px solid #bbf7d0" : "1px solid #e5e7eb",
                                        backgroundColor: member.preferences_completed ? "#f0fdf4" : "#f9fafb",
                                    }}
                                >
                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                        <span style={{
                                            color: "#111827",
                                            fontSize: "14px",
                                            fontWeight: "500",
                                        }}>
                                            {member.name || member.email}
                                        </span>
                                        {member.name && (
                                            <span style={{
                                                color: "#6b7280",
                                                fontSize: "12px",
                                            }}>
                                                {member.email}
                                            </span>
                                        )}
                                        {!member.has_joined && (
                                            <span style={{
                                                color: "#f59e0b",
                                                fontSize: "12px",
                                                fontStyle: "italic",
                                            }}>
                                                Invited (not joined yet)
                                            </span>
                                        )}
                                    </div>
                                    {member.preferences_completed ? (
                                        <Check style={{ width: "20px", height: "20px", color: "#16a34a" }} />
                                    ) : (
                                        <Clock style={{ width: "20px", height: "20px", color: "#9ca3af" }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Invite Code Card */}
                <Card style={{
                    borderColor: "#e9d5ff",
                    boxShadow: "0 20px 25px rgba(0, 0, 0, 0.1)",
                    marginBottom: "24px",
                }}>
                    <CardContent style={{ padding: "24px" }}>
                        <div style={{ textAlign: "center" }}>
                            <p style={{
                                color: "#111827",
                                marginBottom: "12px",
                                fontSize: "16px",
                                fontWeight: "600",
                            }}>
                                Household Invite Code
                            </p>
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                justifyContent: "center",
                            }}>
                                <div style={{
                                    backgroundColor: "#faf5ff",
                                    border: "1px solid #e9d5ff",
                                    borderRadius: "8px",
                                    padding: "12px 24px",
                                }}>
                                    <code style={{
                                        color: "#7c3aed",
                                        letterSpacing: "0.1em",
                                        fontSize: "18px",
                                        fontWeight: "600",
                                    }}>
                                        {displayInviteCode}
                                    </code>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={handleCopyCode}
                                    style={{
                                        borderColor: "#d8b4fe",
                                        backgroundColor: copied ? "#faf5ff" : "white",
                                        padding: "12px",
                                        minWidth: "44px",
                                        height: "44px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    {copied ? (
                                        <Check style={{ width: "16px", height: "16px", color: "#16a34a" }} />
                                    ) : (
                                        <Copy style={{ width: "16px", height: "16px", color: "#7c3aed" }} />
                                    )}
                                </Button>
                            </div>
                            <p style={{
                                color: "#6b7280",
                                fontSize: "12px",
                                marginTop: "12px",
                            }}>
                                Share this code with your roommates so they can join
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Action Button - Always show, but disabled until all completed */}
                <Button
                    onClick={onContinue}
                    disabled={!allCompleted}
                    style={{
                        width: "100%",
                        backgroundColor: allCompleted ? "#16a34a" : "#d1d5db",
                        color: allCompleted ? "white" : "#9ca3af",
                        padding: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "16px",
                        fontWeight: "600",
                        cursor: allCompleted ? "pointer" : "not-allowed",
                        opacity: allCompleted ? 1 : 0.6,
                        transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                        if (allCompleted) {
                            e.currentTarget.style.backgroundColor = "#15803d";
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (allCompleted) {
                            e.currentTarget.style.backgroundColor = "#16a34a";
                        }
                    }}
                >
                    <Sparkles style={{ width: "20px", height: "20px", marginRight: "8px" }} />
                    Generate Household Schedule
                </Button>

                {!allCompleted && (
                    <div style={{ textAlign: "center", marginTop: "16px" }}>
                        <p style={{ color: "#6b7280", fontSize: "12px" }}>
                            Waiting for {totalCount - completedCount} more roommate{totalCount - completedCount !== 1 ? 's' : ''} to complete their survey
                        </p>
                    </div>
                )}
            </div>

            {/* Pulse animation for Clock */}
            <style>{`
                @keyframes pulse {
                  0%, 100% {
                    opacity: 1;
                  }
                  50% {
                    opacity: 0.5;
                  }
                }
            `}</style>
        </div>
    );
}