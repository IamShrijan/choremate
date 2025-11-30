import { Sparkles, Check, Clock, Copy } from "lucide-react";
import Button from "../components/button";
import { Card, CardContent } from "../components/card";
import { useState } from "react";

export default function WaitingForRoommatesPage({
    inviteCode,
    roommates,
    onContinue = () => { },
}) {
    const [copied, setCopied] = useState(false);
    const completedCount = roommates.filter((r) => r.completed).length;
    const totalCount = roommates.length;
    const allCompleted = completedCount === totalCount;

    const handleCopyCode = () => {
        navigator.clipboard.writeText(inviteCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                        {allCompleted ? "Everyone's Ready!" : "Waiting for Roommates"}
                    </h1>
                    <p style={{ color: "#6b7280", fontSize: "16px" }}>
                        {allCompleted
                            ? "All roommates have completed their surveys"
                            : "Your roommates need to complete their preference surveys"}
                    </p>
                </div>

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
                                width: `${(completedCount / totalCount) * 100}%`,
                            }} />
                        </div>

                        {/* Roommate List */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {roommates.map((roommate, index) => (
                                <div
                                    key={index}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "16px",
                                        borderRadius: "8px",
                                        border: roommate.completed ? "1px solid #bbf7d0" : "1px solid #e5e7eb",
                                        backgroundColor: roommate.completed ? "#f0fdf4" : "#f9fafb",
                                    }}
                                >
                                    <span style={{
                                        color: "#111827",
                                        fontSize: "12px",
                                    }}>
                                        {roommate.emailOrPhone}
                                    </span>
                                    {roommate.completed ? (
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
                                        {inviteCode}
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

                {/* Action Button */}
                {/* TODO: Re add All Completed logic after backend is ready */}
                {/* {allCompleted && onContinue && ( */}
                {onContinue && (
                    <Button
                        onClick={onContinue}
                        style={{
                            width: "100%",
                            backgroundColor: "#16a34a",
                            color: "white",
                            padding: "24px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "16px",
                            fontWeight: "600",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#15803d";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#16a34a";
                        }}
                    >
                        <Sparkles style={{ width: "20px", height: "20px", marginRight: "8px" }} />
                        Generate Household Schedule
                    </Button>
                )}

                {!allCompleted && (
                    <div style={{ textAlign: "center" }}>
                        <p style={{ color: "#6b7280", fontSize: "12px" }}>
                            We'll notify you when everyone completes their survey
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