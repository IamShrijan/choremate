import { useState } from "react";
import { ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import Button from "../components/button";
import { Slider } from "../components/slider";
import { Textarea } from "../components/textarea";
import { Card, CardContent } from "../components/card";
import { preferencesAPI } from "../utils/api";

const chores = [
    { id: "kitchen-counters", name: "Kitchen Counters", emoji: "🧽" },
    { id: "dishes", name: "Dishes", emoji: "🍽️" },
    { id: "kitchen-floors", name: "Kitchen Floors", emoji: "🧹" },
    { id: "trash", name: "Taking Out Trash", emoji: "🗑️" },
    { id: "toilet", name: "Cleaning Toilet", emoji: "🚽" },
    { id: "shower", name: "Cleaning Shower", emoji: "🚿" },
    { id: "bathroom-sink", name: "Bathroom Sink", emoji: "🪥" },
    { id: "bathroom-floors", name: "Bathroom Floors", emoji: "🧽" },
    { id: "living-room", name: "Living Room Tidying", emoji: "🛋️" },
    { id: "vacuuming", name: "Vacuuming", emoji: "🪠" },
    { id: "dusting", name: "Dusting", emoji: "🧹" },
    { id: "grocery", name: "Grocery Shopping", emoji: "🛒" }
];

export default function SurveyFlow({ onComplete = () => { }, onBack = () => { } }) {
    const [step, setStep] = useState(1);
    const [cleanliness, setCleanliness] = useState(2);
    const [availability, setAvailability] = useState({
        times: [],
        days: []
    });
    const [chorePreferences, setChorePreferences] = useState({});
    const [considerations, setConsiderations] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const cleanlinessLevels = [
        "Presentable",
        "Livable",
        "Tidy",
        "Clean",
        "Spotless",
    ];

    const handleTimeToggle = (time) => {
        setAvailability((prev) => ({
            ...prev,
            times: prev.times.includes(time)
                ? prev.times.filter((t) => t !== time)
                : [...prev.times, time],
        }));
    };

    const handleDayToggle = (day) => {
        setAvailability((prev) => ({
            ...prev,
            days: prev.days.includes(day)
                ? prev.days.filter((d) => d !== day)
                : [...prev.days, day],
        }));
    };

    const handleChoreToggle = (choreId) => {
        setChorePreferences((prev) => {
            const current = prev[choreId] || "neutral";
            let next;

            if (current === "neutral") {
                next = "dont mind";
            } else if (current === "dont mind") {
                next = "prefer to avoid";
            } else if (current === "prefer to avoid") {
                next = "neutral";
            } else {
                next = "neutral";
            }

            // If going back to neutral, remove the key from the object
            if (next === "neutral") {
                const newPrefs = { ...prev };
                delete newPrefs[choreId];
                return newPrefs;
            }

            return { ...prev, [choreId]: next };
        });
    };

    const getChoreButtonStyle = (choreId) => {
        const preference = chorePreferences[choreId] || "neutral";
        const baseStyle = {
            padding: "16px",
            borderRadius: "8px",
            border: "2px solid",
            transition: "all 0.3s ease",
            cursor: "pointer",
            textAlign: "center",
            backgroundColor: "white",
        };

        if (preference === "dont mind") {
            return {
                ...baseStyle,
                borderColor: "#22c55e",
                backgroundColor: "#f0fdf4",
                color: "#15803d",
            };
        }
        if (preference === "prefer to avoid") {
            return {
                ...baseStyle,
                borderColor: "#ef4444",
                backgroundColor: "#fee2e2",
                color: "#dc2626",
            };
        }
        return {
            ...baseStyle,
            borderColor: "#d1d5db",
            color: "#374151",
        };
    };

    const handleNext = () => {
        if (step < 4) {
            setStep(step + 1);
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        }
    };

    const handleGenerateSchedule = async () => {
        setLoading(true);
        setError("");
        
        try {
            // Map chore IDs to actual chore names from backend
            const choreNameMapping = {
                "kitchen-counters": "Kitchen Counters",
                "dishes": "Dishes",
                "kitchen-floors": "Kitchen Floors",
                "trash": "Taking Out Trash",
                "toilet": "Cleaning Toilet",
                "shower": "Cleaning Shower",
                "bathroom-sink": "Bathroom Sink",
                "bathroom-floors": "Bathroom Floors",
                "living-room": "Living Room Tidying",
                "vacuuming": "Vacuuming",
                "dusting": "Dusting",
                "grocery": "Grocery Shopping"
            };

            // Convert chore preferences from frontend IDs to backend names
            const backendChorePreferences = {};
            Object.entries(chorePreferences).forEach(([choreId, preference]) => {
                const choreName = choreNameMapping[choreId];
                if (choreName) {
                    backendChorePreferences[choreName] = preference;
                }
            });

            // Prepare data for backend
            const preferencesData = {
                cleanliness_level: cleanliness + 1, // Convert 0-4 index to 1-5 scale
                // Convert to lowercase
                time_availability: availability.times.map(t => t.toLowerCase()),
                // Convert "Weekdays" -> "weekday", "Weekends" -> "weekend" (singular, lowercase)
                day_availability: availability.days.map(d => d.toLowerCase().replace(/s$/, '')),
                chore_preferences: backendChorePreferences,
                special_requirements: considerations || "",
            };

            // Save to backend
            await preferencesAPI.updatePreferences(preferencesData);
            
            // Then navigate to next page
            onComplete({
                cleanliness: cleanlinessLevels[cleanliness],
                availability,
                chorePreferences,
                considerations,
            });
        } catch (err) {
            console.error("Failed to save preferences:", err);
            setError(err.message || "Failed to save preferences. Please try again.");
            setLoading(false);
        }
    };

    const progressDots = [1, 2, 3, 4].map((dot) => {
        let dotStyle = {
            height: "8px",
            borderRadius: "9999px",
            transition: "all 0.3s ease",
            width: "8px",
            backgroundColor: "#d1d5db",
        };

        if (dot === step) {
            dotStyle = { ...dotStyle, width: "32px", backgroundColor: "#7c3aed" };
        } else if (dot < step) {
            dotStyle = { ...dotStyle, backgroundColor: "#22c55e" };
        }

        return <div key={dot} style={dotStyle} />;
    });

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(to bottom right, #faf5ff, #f3e8ff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
        }}>
            <div style={{ width: "100%", maxWidth: "896px" }}>
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
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        marginBottom: "16px",
                    }}>
                        {progressDots}
                    </div>
                    <p style={{ color: "#6b7280" }}>Step {step} of 4</p>
                </div>

                <Card style={{ borderColor: "#e9d5ff", boxShadow: "0 20px 25px rgba(0, 0, 0, 0.1)" }}>
                    <CardContent style={{ padding: "32px" }}>
                        {/* Step 1: Cleanliness Preference */}
                        {step === 1 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                                <div style={{ textAlign: "center" }}>
                                    <h2 style={{
                                        color: "#111827",
                                        marginBottom: "8px",
                                        fontSize: "24px",
                                        fontWeight: "600",
                                    }}>
                                        How clean do you like your shared spaces?
                                    </h2>
                                    <p style={{ color: "#6b7280" }}>
                                        This helps us understand your expectations
                                    </p>
                                </div>

                                <div style={{ padding: "0 16px" }}>
                                    <div style={{ marginBottom: "24px" }}>
                                        <Slider
                                            value={[cleanliness]}
                                            onValueChange={(value) => setCleanliness(value[0])}
                                            max={4}
                                            step={1}
                                            style={{ width: "100%" }}
                                        />
                                    </div>

                                    <div style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        fontSize: "12px",
                                        color: "#6b7280",
                                        marginBottom: "8px",
                                    }}>
                                        {cleanlinessLevels.map((level, index) => (
                                            <span
                                                key={level}
                                                style={{
                                                    color: index === cleanliness ? "#7c3aed" : "#6b7280",
                                                    fontWeight: index === cleanliness ? "600" : "normal",
                                                }}
                                            >
                                                {level}
                                            </span>
                                        ))}
                                    </div>

                                    <div style={{
                                        textAlign: "center",
                                        marginTop: "32px",
                                        padding: "16px",
                                        backgroundColor: "#f3e8ff",
                                        borderRadius: "8px",
                                    }}>
                                        <p style={{ color: "#581c87", fontWeight: "600" }}>
                                            Selected: {cleanlinessLevels[cleanliness]}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: "12px" }}>
                                    <Button
                                        onClick={handleBack}
                                        variant="outline"
                                        style={{
                                            flex: 1,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <ChevronLeft style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleNext}
                                        style={{
                                            flex: 2,
                                            backgroundColor: "#7c3aed",
                                            color: "white",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        Continue
                                        <ChevronRight style={{ width: "16px", height: "16px", marginLeft: "8px" }} />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Availability */}
                        {step === 2 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                                <div style={{ textAlign: "center" }}>
                                    <h2 style={{
                                        color: "#111827",
                                        marginBottom: "8px",
                                        fontSize: "24px",
                                        fontWeight: "600",
                                    }}>
                                        When are you typically available?
                                    </h2>
                                    <p style={{ color: "#6b7280" }}>
                                        Select the times that best work for you
                                    </p>
                                </div>

                                <div>
                                    <p style={{ color: "#111827", marginBottom: "12px", fontWeight: "600" }}>
                                        Time of Day
                                    </p>
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(4, 1fr)",
                                        gap: "12px",
                                    }}>
                                        {["Morning", "Afternoon", "Evening", "Night"].map((time) => (
                                            <Button
                                                key={time}
                                                variant="outline"
                                                onClick={() => handleTimeToggle(time)}
                                                style={{
                                                    borderColor: availability.times.includes(time) ? "#7c3aed" : "#d1d5db",
                                                    backgroundColor: availability.times.includes(time) ? "#f3e8ff" : "white",
                                                    color: availability.times.includes(time) ? "#7c3aed" : "#374151",
                                                }}
                                            >
                                                {time}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p style={{ color: "#111827", marginBottom: "12px", fontWeight: "600" }}>
                                        Days
                                    </p>
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(2, 1fr)",
                                        gap: "12px",
                                    }}>
                                        {["Weekday", "Weekend"].map((day) => (
                                            <Button
                                                key={day}
                                                variant="outline"
                                                onClick={() => handleDayToggle(day)}
                                                style={{
                                                    borderColor: availability.days.includes(day) ? "#7c3aed" : "#d1d5db",
                                                    backgroundColor: availability.days.includes(day) ? "#f3e8ff" : "white",
                                                    color: availability.days.includes(day) ? "#7c3aed" : "#374151",
                                                }}
                                            >
                                                {day}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: "flex", gap: "12px" }}>
                                    <Button
                                        onClick={handleBack}
                                        variant="outline"
                                        style={{
                                            flex: 1,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <ChevronLeft style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleNext}
                                        disabled={
                                            availability.times.length === 0 ||
                                            availability.days.length === 0
                                        }
                                        style={{
                                            flex: 2,
                                            backgroundColor: "#7c3aed",
                                            color: "white",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            opacity: (availability.times.length === 0 || availability.days.length === 0) ? 0.5 : 1,
                                        }}
                                    >
                                        Continue
                                        <ChevronRight style={{ width: "16px", height: "16px", marginLeft: "8px" }} />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Chore Preferences */}
                        {step === 3 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                                <div style={{ textAlign: "center" }}>
                                    <h2 style={{
                                        color: "#111827",
                                        marginBottom: "8px",
                                        fontSize: "24px",
                                        fontWeight: "600",
                                    }}>
                                        Chore Preferences
                                    </h2>
                                    <p style={{ color: "#6b7280", marginBottom: "16px" }}>
                                        Tap chores to toggle your preference.
                                    </p>
                                </div>

                                <div style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                                    gap: "12px",
                                }}>
                                    {chores.map((chore) => (
                                        <button
                                            key={chore.id}
                                            onClick={() => handleChoreToggle(chore.id)}
                                            style={getChoreButtonStyle(chore.id)}
                                        >
                                            <div style={{ fontSize: "32px", marginBottom: "8px" }}>
                                                {chore.emoji}
                                            </div>
                                            <div style={{ fontSize: "12px" }}>{chore.name}</div>
                                        </button>
                                    ))}
                                </div>

                                <div style={{
                                    display: "flex",
                                    gap: "12px",
                                    fontSize: "12px",
                                    color: "#6b7280",
                                    justifyContent: "center",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                        <div style={{
                                            width: "12px",
                                            height: "12px",
                                            borderRadius: "2px",
                                            backgroundColor: "#22c55e",
                                        }} />
                                        <span>Don't Mind</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                        <div style={{
                                            width: "12px",
                                            height: "12px",
                                            borderRadius: "2px",
                                            backgroundColor: "#d1d5db",
                                        }} />
                                        <span>Neutral</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                        <div style={{
                                            width: "12px",
                                            height: "12px",
                                            borderRadius: "2px",
                                            backgroundColor: "#ef4444",
                                        }} />
                                        <span>Prefer to Avoid</span>
                                    </div>
                                </div>

                                <div style={{ display: "flex", gap: "12px" }}>
                                    <Button
                                        onClick={handleBack}
                                        variant="outline"
                                        style={{
                                            flex: 1,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <ChevronLeft style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleNext}
                                        style={{
                                            flex: 2,
                                            backgroundColor: "#7c3aed",
                                            color: "white",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        Continue
                                        <ChevronRight style={{ width: "16px", height: "16px", marginLeft: "8px" }} />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Special Considerations */}
                        {step === 4 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                                <div style={{ textAlign: "center" }}>
                                    <h2 style={{
                                        color: "#111827",
                                        marginBottom: "8px",
                                        fontSize: "24px",
                                        fontWeight: "600",
                                    }}>
                                        Any special considerations?
                                    </h2>
                                    <p style={{ color: "#6b7280" }}>
                                        Optional: Share any specific needs or preferences
                                    </p>
                                </div>

                                <Textarea
                                    value={considerations}
                                    onChange={(e) => setConsiderations(e.target.value)}
                                    placeholder="e.g., I have allergies to certain cleaning products, I prefer to do chores in the morning, I'm unavailable on Tuesday evenings..."
                                    style={{
                                        minHeight: "150px",
                                        resize: "none",
                                    }}
                                />

                                <div style={{ display: "flex", gap: "12px" }}>
                                    <Button
                                        onClick={handleBack}
                                        variant="outline"
                                        style={{
                                            flex: 1,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <ChevronLeft style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleGenerateSchedule}
                                        style={{
                                            flex: 2,
                                            backgroundColor: "#7c3aed",
                                            color: "white",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Sparkles style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                                        Complete Survey
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}