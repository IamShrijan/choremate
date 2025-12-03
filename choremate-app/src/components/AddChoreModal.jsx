import React, { useState } from "react";
import {
    X,
    Calendar,
    User,
    Clock,
    Repeat,
} from "lucide-react";

export default function AddChoreModal({ onClose, onAdd }) {
    const [choreName, setChoreName] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [assignedTo, setAssignedTo] = useState("");
    const [effort, setEffort] = useState("");
    const [frequency, setFrequency] = useState("");
    const [priority, setPriority] = useState("");
    const [notes, setNotes] = useState("");

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

    const handleSubmit = (e) => {
        e.preventDefault();

        // Create new chore object
        const newChore = {
            id: Date.now(), // Temporary ID for dummy data
            name: choreName,
            dueDate: `${dueDate}T${dueTime || "12:00"}:00`,
            effort: parseInt(effort) || 30,
            priority: priority || "medium",
            assignedTo: assignedTo || "Unassigned",
            frequency: frequency || "One-time",
            notes: notes || "",
        };

        console.log("New chore created:", newChore);

        // Call the onAdd callback if provided
        if (onAdd) {
            onAdd(newChore);
        }

        onClose();
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
                zIndex: 51,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
            }}>
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        backgroundColor: "white",
                        borderRadius: "12px",
                        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                        width: "100%",
                        maxWidth: "672px",
                        maxHeight: "90vh",
                        overflow: "auto",
                    }}
                >
                    {/* Header */}
                    <div style={{
                        position: "sticky",
                        top: 0,
                        backgroundColor: "white",
                        borderBottom: "1px solid #e5e7eb",
                        padding: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}>
                        <h2 style={{
                            fontSize: "24px",
                            fontWeight: "600",
                            color: "#111827",
                        }}>
                            Add New Chore
                        </h2>
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

                    {/* Form */}
                    <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {/* Chore Name */}
                            <div>
                                <label style={{
                                    display: "block",
                                    fontSize: "14px",
                                    fontWeight: "500",
                                    color: "#111827",
                                    marginBottom: "8px",
                                }}>
                                    Chore Name *
                                </label>
                                <input
                                    type="text"
                                    value={choreName}
                                    onChange={(e) => setChoreName(e.target.value)}
                                    placeholder="e.g., Mop Kitchen Floor"
                                    required
                                    style={{
                                        width: "100%",
                                        padding: "10px 12px",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "8px",
                                        fontSize: "14px",
                                        fontFamily: "system-ui, -apple-system, sans-serif",
                                    }}
                                />
                            </div>

                            {/* Due Date & Time */}
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                gap: "16px",
                            }}>
                                <div>
                                    <label style={{
                                        display: "block",
                                        fontSize: "14px",
                                        fontWeight: "500",
                                        color: "#111827",
                                        marginBottom: "8px",
                                    }}>
                                        <Calendar style={{ width: "16px", height: "16px", display: "inline", marginRight: "8px" }} />
                                        Due Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        required
                                        style={{
                                            width: "100%",
                                            padding: "10px 12px",
                                            border: "1px solid #e5e7eb",
                                            borderRadius: "8px",
                                            fontSize: "14px",
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{
                                        display: "block",
                                        fontSize: "14px",
                                        fontWeight: "500",
                                        color: "#111827",
                                        marginBottom: "8px",
                                    }}>
                                        <Clock style={{ width: "16px", height: "16px", display: "inline", marginRight: "8px" }} />
                                        Time
                                    </label>
                                    <input
                                        type="time"
                                        value={dueTime}
                                        onChange={(e) => setDueTime(e.target.value)}
                                        style={{
                                            width: "100%",
                                            padding: "10px 12px",
                                            border: "1px solid #e5e7eb",
                                            borderRadius: "8px",
                                            fontSize: "14px",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Assigned To & Effort */}
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                gap: "16px",
                            }}>
                                <div>
                                    <label style={{
                                        display: "block",
                                        fontSize: "14px",
                                        fontWeight: "500",
                                        color: "#111827",
                                        marginBottom: "8px",
                                    }}>
                                        <User style={{ width: "16px", height: "16px", display: "inline", marginRight: "8px" }} />
                                        Assigned To *
                                    </label>
                                    <select
                                        value={assignedTo}
                                        onChange={(e) => setAssignedTo(e.target.value)}
                                        required
                                        style={{
                                            width: "100%",
                                            padding: "10px 12px",
                                            border: "1px solid #e5e7eb",
                                            borderRadius: "8px",
                                            fontSize: "14px",
                                            backgroundColor: "white",
                                        }}
                                    >
                                        <option value="">Select roommate</option>
                                        <option value="John Doe">John Doe</option>
                                        <option value="Sarah Chen">Sarah Chen</option>
                                        <option value="Prashant Kumar">Prashant Kumar</option>
                                        <option value="Jack Wilson">Jack Wilson</option>
                                        <option value="Shrijan Patel">Shrijan Patel</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{
                                        display: "block",
                                        fontSize: "14px",
                                        fontWeight: "500",
                                        color: "#111827",
                                        marginBottom: "8px",
                                    }}>
                                        <Clock style={{ width: "16px", height: "16px", display: "inline", marginRight: "8px" }} />
                                        Estimated Time (minutes)
                                    </label>
                                    <input
                                        type="number"
                                        value={effort}
                                        onChange={(e) => setEffort(e.target.value)}
                                        placeholder="e.g., 45"
                                        min="1"
                                        required
                                        style={{
                                            width: "100%",
                                            padding: "10px 12px",
                                            border: "1px solid #e5e7eb",
                                            borderRadius: "8px",
                                            fontSize: "14px",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Frequency */}
                            <div>
                                <label style={{
                                    display: "block",
                                    fontSize: "14px",
                                    fontWeight: "500",
                                    color: "#111827",
                                    marginBottom: "8px",
                                }}>
                                    <Repeat style={{ width: "16px", height: "16px", display: "inline", marginRight: "8px" }} />
                                    Frequency
                                </label>
                                <select
                                    value={frequency}
                                    onChange={(e) => setFrequency(e.target.value)}
                                    style={{
                                        width: "100%",
                                        padding: "10px 12px",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "8px",
                                        fontSize: "14px",
                                        backgroundColor: "white",
                                    }}
                                >
                                    <option value="">Select frequency</option>
                                    <option value="Daily">Daily</option>
                                    <option value="Every 3 Days">Every 3 Days</option>
                                    <option value="Weekly">Weekly</option>
                                    <option value="Bi-weekly">Bi-weekly</option>
                                    <option value="Monthly">Monthly</option>
                                    <option value="One-time">One-time</option>
                                </select>
                            </div>

                            {/* Priority */}
                            <div>
                                <label style={{
                                    display: "block",
                                    fontSize: "14px",
                                    fontWeight: "500",
                                    color: "#111827",
                                    marginBottom: "8px",
                                }}>
                                    Priority *
                                </label>
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                    required
                                    style={{
                                        width: "100%",
                                        padding: "10px 12px",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "8px",
                                        fontSize: "14px",
                                        backgroundColor: "white",
                                    }}
                                >
                                    <option value="">Select priority</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                            </div>

                            {/* Notes */}
                            <div>
                                <label style={{
                                    display: "block",
                                    fontSize: "14px",
                                    fontWeight: "500",
                                    color: "#111827",
                                    marginBottom: "8px",
                                }}>
                                    Notes / Instructions
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add any additional notes or instructions..."
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
                            </div>

                            {/* Actions */}
                            <div style={{
                                display: "flex",
                                gap: "8px",
                                paddingTop: "16px",
                                borderTop: "1px solid #e5e7eb",
                            }}>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    style={{
                                        flex: 1,
                                        padding: "12px",
                                        backgroundColor: "white",
                                        color: "#374151",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                        fontSize: "14px",
                                        fontWeight: "600",
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        flex: 1,
                                        padding: "12px",
                                        backgroundColor: "#7c3aed",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                        fontSize: "14px",
                                        fontWeight: "600",
                                    }}
                                >
                                    Create Chore
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
