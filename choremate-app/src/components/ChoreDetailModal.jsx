import React, { useState } from "react";
import {
    X,
    Calendar,
    Users,
    Clock,
    Plus,
    Edit,
} from "lucide-react";

// Avatar Component
function Avatar({ src, alt, size = "40px" }) {
    return (
        <div style={{
            width: size,
            height: size,
            borderRadius: "50%",
            overflow: "hidden",
            backgroundColor: "#e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
        }}>
            {src ? (
                <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
                <span style={{ color: "#6b7280", fontSize: "14px", fontWeight: "600" }}>{alt}</span>
            )}
        </div>
    );
}

// Chore Detail Modal Component
export default function ChoreDetailModal({ chore, onClose, onComplete, onRefresh }) {
    const [notes, setNotes] = useState(chore.notes || "");
    const [isRescheduling, setIsRescheduling] = useState(false);
    const [newDueDate, setNewDueDate] = useState(() => {
        const date = new Date(chore.dueDate);
        return date.toISOString().split("T")[0];
    });
    const [newDueTime, setNewDueTime] = useState(() => {
        const date = new Date(chore.dueDate);
        return date.toTimeString().slice(0, 5);
    });

    // ESC key listener
    React.useEffect(() => {
        const handleEscKey = (event) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscKey);
        return () => {
            document.removeEventListener("keydown", handleEscKey);
        };
    }, [onClose]);

    const priorityColors = {
        high: { bg: "#fee2e2", text: "#991b1b", border: "#fecaca" },
        medium: { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
        low: { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" },
    };

    const formatDueDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
        });
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const handleMarkComplete = () => {
        if (onComplete) {
            onComplete(chore.id);
        }
    };

    const handleReschedule = async () => {
        try {
            // Import the API
            const { choresAPI } = await import('../utils/api');

            // Combine date and time into ISO format
            const newDueDateISO = `${newDueDate}T${newDueTime}:00`;

            console.log("Rescheduling chore to:", newDueDateISO);

            // Call the API to update due date
            await choresAPI.updateDueDate(chore.id, newDueDateISO);

            console.log("Due date updated successfully");

            // Close reschedule mode
            setIsRescheduling(false);

            // Trigger refresh in parent BEFORE closing modal
            if (onRefresh) {
                console.log("Calling onRefresh...");
                await onRefresh();
                console.log("Refresh complete");
            } else {
                console.warn("onRefresh callback not provided");
            }

            // Close the modal after refresh completes
            onClose();
        } catch (error) {
            console.error("Error rescheduling chore:", error);
            alert("Failed to reschedule chore. Please try again.");
        }
    };

    const handleSaveNotes = () => {
        console.log("Saving notes:", notes);
    };

    return (
        <>
            {/* Backdrop */}
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    zIndex: 50,
                }}
                onClick={onClose}
            />

            {/* Modal */}
            <div style={{
                position: "fixed",
                inset: 0,
                zIndex: 50,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
            }}>
                <div style={{
                    backgroundColor: "white",
                    borderRadius: "12px",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                    width: "100%",
                    maxWidth: "672px",
                    maxHeight: "90vh",
                    overflow: "auto",
                }}>
                    {/* Header */}
                    <div style={{
                        position: "sticky",
                        top: 0,
                        backgroundColor: "white",
                        borderBottom: "1px solid #e5e7eb",
                        padding: "24px",
                        display: "flex",
                        alignItems: "start",
                        justifyContent: "space-between",
                    }}>
                        <div style={{ display: "flex", alignItems: "start", gap: "16px", flex: 1 }}>
                            <div style={{
                                width: "48px",
                                height: "48px",
                                backgroundColor: "#f3e8ff",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}>
                                <Clock style={{ width: "24px", height: "24px", color: "#7c3aed" }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h2 style={{
                                    fontSize: "24px",
                                    fontWeight: "600",
                                    color: "#111827",
                                    marginBottom: "8px",
                                }}>
                                    {chore.name}
                                </h2>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{
                                        padding: "4px 12px",
                                        borderRadius: "12px",
                                        fontSize: "12px",
                                        fontWeight: "500",
                                        backgroundColor: priorityColors[chore.priority].bg,
                                        color: priorityColors[chore.priority].text,
                                        border: `1px solid ${priorityColors[chore.priority].border}`,
                                    }}>
                                        {chore.priority.charAt(0).toUpperCase() + chore.priority.slice(1)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
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
                            <X style={{ width: "20px", height: "20px" }} />
                        </button>
                    </div>

                    {/* Content */}
                    <div style={{ padding: "24px" }}>
                        {/* Due Date & Assigned To */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                            gap: "16px",
                            marginBottom: "16px",
                        }}>
                            <div style={{
                                backgroundColor: "#f9fafb",
                                borderRadius: "8px",
                                padding: "16px",
                                border: "1px solid #e5e7eb",
                            }}>
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    marginBottom: "8px",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#6b7280" }}>
                                        <Calendar style={{ width: "16px", height: "16px" }} />
                                        <span style={{ fontSize: "12px" }}>Due Date</span>
                                    </div>
                                    {!isRescheduling && (
                                        <button
                                            onClick={() => setIsRescheduling(true)}
                                            style={{
                                                padding: "4px 8px",
                                                backgroundColor: "transparent",
                                                border: "none",
                                                color: "#7c3aed",
                                                cursor: "pointer",
                                                fontSize: "12px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px",
                                            }}
                                        >
                                            <Edit style={{ width: "12px", height: "12px" }} />
                                        </button>
                                    )}
                                </div>
                                {!isRescheduling ? (
                                    <>
                                        <p style={{ fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                                            {formatDueDate(chore.dueDate)}
                                        </p>
                                        <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                                            {formatTime(chore.dueDate)}
                                        </p>
                                    </>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        <div>
                                            <label style={{ fontSize: "12px", color: "#6b7280", display: "block", marginBottom: "4px" }}>
                                                New Date
                                            </label>
                                            <input
                                                type="date"
                                                value={newDueDate}
                                                onChange={(e) => setNewDueDate(e.target.value)}
                                                style={{
                                                    width: "100%",
                                                    padding: "8px",
                                                    border: "1px solid #e5e7eb",
                                                    borderRadius: "6px",
                                                    fontSize: "14px",
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: "12px", color: "#6b7280", display: "block", marginBottom: "4px" }}>
                                                New Time
                                            </label>
                                            <input
                                                type="time"
                                                value={newDueTime}
                                                onChange={(e) => setNewDueTime(e.target.value)}
                                                style={{
                                                    width: "100%",
                                                    padding: "8px",
                                                    border: "1px solid #e5e7eb",
                                                    borderRadius: "6px",
                                                    fontSize: "14px",
                                                }}
                                            />
                                        </div>
                                        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                                            <button
                                                onClick={handleReschedule}
                                                style={{
                                                    flex: 1,
                                                    padding: "8px",
                                                    backgroundColor: "#7c3aed",
                                                    color: "white",
                                                    border: "none",
                                                    borderRadius: "6px",
                                                    cursor: "pointer",
                                                    fontSize: "12px",
                                                    fontWeight: "600",
                                                }}
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setIsRescheduling(false)}
                                                style={{
                                                    flex: 1,
                                                    padding: "8px",
                                                    backgroundColor: "white",
                                                    color: "#374151",
                                                    border: "1px solid #e5e7eb",
                                                    borderRadius: "6px",
                                                    cursor: "pointer",
                                                    fontSize: "12px",
                                                    fontWeight: "600",
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{
                                backgroundColor: "#f9fafb",
                                borderRadius: "8px",
                                padding: "16px",
                                border: "1px solid #e5e7eb",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#6b7280", marginBottom: "8px" }}>
                                    <Users style={{ width: "16px", height: "16px" }} />
                                    <span style={{ fontSize: "12px" }}>Assigned To</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <Avatar
                                        src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop"
                                        alt="User"
                                        size="32px"
                                    />
                                    <span style={{ fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                                        {chore.assignedTo}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Effort & Frequency */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                            gap: "16px",
                            marginBottom: "16px",
                        }}>
                            <div style={{
                                backgroundColor: "#f9fafb",
                                borderRadius: "8px",
                                padding: "16px",
                                border: "1px solid #e5e7eb",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#6b7280", marginBottom: "8px" }}>
                                    <Clock style={{ width: "16px", height: "16px" }} />
                                    <span style={{ fontSize: "12px" }}>Estimated Time</span>
                                </div>
                                <p style={{ fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                                    ~{chore.effort} min
                                </p>
                            </div>

                            <div style={{
                                backgroundColor: "#f9fafb",
                                borderRadius: "8px",
                                padding: "16px",
                                border: "1px solid #e5e7eb",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#6b7280", marginBottom: "8px" }}>
                                    <Calendar style={{ width: "16px", height: "16px" }} />
                                    <span style={{ fontSize: "12px" }}>Frequency</span>
                                </div>
                                <p style={{ fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                                    {chore.frequency}
                                </p>
                            </div>
                        </div>

                        {/* Notes */}
                        <div style={{ marginBottom: "16px" }}>
                            <label style={{
                                fontSize: "14px",
                                fontWeight: "500",
                                color: "#111827",
                                display: "block",
                                marginBottom: "8px",
                            }}>
                                Notes / Instructions
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Add notes or instructions for this chore..."
                                style={{
                                    width: "100%",
                                    minHeight: "100px",
                                    padding: "12px",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: "8px",
                                    fontSize: "14px",
                                    resize: "none",
                                    fontFamily: "system-ui, -apple-system, sans-serif",
                                }}
                            />
                            <button
                                onClick={handleSaveNotes}
                                style={{
                                    marginTop: "8px",
                                    padding: "8px 16px",
                                    backgroundColor: "white",
                                    color: "#374151",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                }}
                            >
                                Save Notes
                            </button>
                        </div>

                        {/* Actions */}
                        <div>
                            <h4 style={{
                                fontSize: "14px",
                                fontWeight: "500",
                                color: "#111827",
                                marginBottom: "12px",
                            }}>
                                Actions
                            </h4>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <button
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        backgroundColor: "#7c3aed",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                        fontSize: "14px",
                                        fontWeight: "600",
                                        transition: "all 0.2s ease",
                                    }}
                                    onClick={async () => {
                                        if (onComplete) {
                                            await onComplete(chore.id);
                                            onClose(); // Close modal after completing
                                        }
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = "#6d28d9";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = "#7c3aed";
                                    }}
                                >
                                    Mark as Complete
                                </button>
                                <div style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                                    gap: "8px",
                                }}>
                                    <button
                                        style={{
                                            padding: "12px",
                                            backgroundColor: "white",
                                            color: "#111827",
                                            border: "1px solid #111827",
                                            borderRadius: "8px",
                                            cursor: "pointer",
                                            fontSize: "14px",
                                            fontWeight: "600",
                                        }}
                                    >
                                        Request Swap
                                    </button>
                                    <button
                                        onClick={() => setIsRescheduling(true)}
                                        style={{
                                            padding: "12px",
                                            backgroundColor: "white",
                                            color: "#111827",
                                            border: "1px solid #111827",
                                            borderRadius: "8px",
                                            cursor: "pointer",
                                            fontSize: "14px",
                                            fontWeight: "600",
                                        }}
                                    >
                                        Reschedule
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
