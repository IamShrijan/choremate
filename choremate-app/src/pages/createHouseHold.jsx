import React, { useState } from "react";
import { Sparkles, ChevronRight, X, Plus, Users, ArrowLeft } from "lucide-react";
import Button from "../components/button";
import Input from "../components/input";
import Label from "../components/label";
import { Card, CardContent } from "../components/card";

export default function CreateHousehold({ onComplete = () => { }, onBack = () => { } }) {
    const [step, setStep] = useState(1);
    const [householdName, setHouseholdName] = useState("");
    const [roommates, setRoommates] = useState([]);
    const [newRoommate, setNewRoommate] = useState("");
    const [bedrooms, setBedrooms] = useState(2);
    const [bathrooms, setBathrooms] = useState(1.5);
    const [kitchen, setKitchen] = useState(1);
    const [livingRoom, setLivingRoom] = useState(1);
    const [hasLivingSpace, setHasLivingSpace] = useState(false);
    const [hasPatio, setHasPatio] = useState(false);
    const [otherDetails, setOtherDetails] = useState("");

    const handleAddRoommate = () => {
        if (newRoommate.trim()) {
            setRoommates([
                ...roommates,
                { id: Date.now().toString(), emailOrPhone: newRoommate },
            ]);
            setNewRoommate("");
        }
    };

    const handleRemoveRoommate = (id) => {
        setRoommates(roommates.filter((r) => r.id !== id));
    };

    const handleNext = () => {
        if (step < 2) {
            setStep(step + 1);
        }
    };

    const handleContinueToSurvey = () => {
        onComplete({
            householdName,
            roommates,
            bedrooms,
            bathrooms,
            hasLivingSpace,
            hasPatio,
            otherDetails,
        });
    };

    const progressDots = [1, 2].map((dot) => (
        <div
            key={dot}
            style={{
                height: "8px",
                borderRadius: "9999px",
                transition: "all 0.3s",
                width: dot === step ? "32px" : "8px",
                backgroundColor:
                    dot === step
                        ? "#7c3aed"
                        : dot < step
                            ? "#22c55e"
                            : "#d1d5db",
            }}
        />
    ));

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
            <div style={{ width: "100%", maxWidth: "672px" }}>
                {/* Back Button */}
                {step === 1 && (
                    <BackButton onClick={onBack}>
                        <ArrowLeft style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                        Back
                    </BackButton>
                )}

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
                        boxShadow: "0 10px 15px rgba(0, 0, 0, 0.1)"
                    }}>
                        <Sparkles style={{ width: "32px", height: "32px", color: "white" }} />
                    </div>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        marginBottom: "16px"
                    }}>
                        {progressDots}
                    </div>
                    <p style={{ color: "#6b7280", fontSize: "14px" }}>Setup Step {step} of 2</p>
                </div>

                <Card style={{ boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)" }}>
                    <CardContent style={{ padding: "32px" }}>
                        {/* Step 1: Household Name & Roommates */}
                        {step === 1 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                                <div style={{ textAlign: "center" }}>
                                    <h2 style={{
                                        fontSize: "24px",
                                        fontWeight: "bold",
                                        color: "#111827",
                                        marginBottom: "8px"
                                    }}>Set Up Your Household</h2>
                                    <p style={{ color: "#6b7280", fontSize: "14px" }}>
                                        Add your roommates - they'll receive invitations to join
                                    </p>
                                </div>

                                <div>
                                    <Label htmlFor="householdName">Household Name (Optional)</Label>
                                    <Input
                                        id="householdName"
                                        type="text"
                                        value={householdName}
                                        onChange={(e) => setHouseholdName(e.target.value)}
                                        placeholder="e.g., The Beach House, Maple Ave Crew"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="roommate">Add Roommates</Label>
                                    <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                                        <Input
                                            id="roommate"
                                            type="text"
                                            value={newRoommate}
                                            onChange={(e) => setNewRoommate(e.target.value)}
                                            placeholder="Email or phone number"
                                            onKeyPress={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleAddRoommate();
                                                }
                                            }}
                                        />
                                        <Button
                                            onClick={handleAddRoommate}
                                            style={{ padding: "12px 16px" }}
                                        >
                                            <Plus style={{ width: "16px", height: "16px" }} />
                                        </Button>
                                    </div>
                                    <p style={{ color: "#6b7280", fontSize: "12px", marginTop: "8px" }}>
                                        Press Enter or click + to add
                                    </p>
                                </div>

                                {/* Roommates List */}
                                {roommates.length > 0 && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        <p style={{ color: "#111827", fontSize: "12px", fontWeight: "600" }}>
                                            Roommates to invite ({roommates.length})
                                        </p>
                                        {roommates.map((roommate) => (
                                            <div
                                                key={roommate.id}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    padding: "12px",
                                                    backgroundColor: "#f9fafb",
                                                    borderRadius: "8px",
                                                    border: "1px solid #e5e7eb"
                                                }}
                                            >
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <Users style={{ width: "16px", height: "16px", color: "#7c3aed" }} />
                                                    <span style={{ color: "#111827", fontSize: "14px" }}>
                                                        {roommate.emailOrPhone}
                                                    </span>
                                                </div>
                                                <RemoveButton onClick={() => handleRemoveRoommate(roommate.id)}>
                                                    <X style={{ width: "16px", height: "16px" }} />
                                                </RemoveButton>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <Button
                                    onClick={handleNext}
                                    style={{
                                        width: "100%",
                                        opacity: roommates.length === 0 ? 0.5 : 1,
                                        cursor: roommates.length === 0 ? "not-allowed" : "pointer"
                                    }}
                                    disabled={roommates.length === 0}
                                >
                                    Continue
                                    <ChevronRight style={{ width: "16px", height: "16px", marginLeft: "8px" }} />
                                </Button>

                                {roommates.length === 0 && (
                                    <p style={{ textAlign: "center", color: "#6b7280", fontSize: "12px" }}>
                                        Add at least one roommate to continue
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Step 2: Apartment Type */}
                        {step === 2 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                                <div style={{ textAlign: "center" }}>
                                    <h2 style={{
                                        fontSize: "24px",
                                        fontWeight: "bold",
                                        color: "#111827",
                                        marginBottom: "8px"
                                    }}>Tell us about your space</h2>
                                    <p style={{ color: "#6b7280", fontSize: "14px" }}>
                                        This helps us create a balanced chore schedule
                                    </p>
                                </div>

                                {/* <div>
                                    <Label>Apartment Type</Label>
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                                        gap: "12px",
                                        marginTop: "8px"
                                    }}>
                                        {[
                                            { value: "apartment", label: "Apartment" },
                                            { value: "house", label: "House" },
                                            { value: "condo", label: "Condo" },
                                            { value: "townhouse", label: "Townhouse" },
                                            { value: "other", label: "Other" }
                                        ].map((option) => (
                                            <SelectButton
                                                key={option.value}
                                                selected={apartmentType === option.value}
                                                onClick={() => setApartmentType(option.value)}
                                            >
                                                {option.label}
                                            </SelectButton>
                                        ))}
                                    </div>
                                </div> */}

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                    <div>
                                        <Label htmlFor="bedrooms">Bedrooms</Label>
                                        <Input
                                            id="bedrooms"
                                            type="number"
                                            value={bedrooms}
                                            onChange={(e) => setBedrooms(e.target.value)}
                                            placeholder="2"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="bathrooms">Bathrooms</Label>
                                        <Input
                                            id="bathrooms"
                                            type="number"
                                            step="0.5"
                                            value={bathrooms}
                                            onChange={(e) => setBathrooms(e.target.value)}
                                            placeholder="1.5"
                                            min="0"
                                        />
                                    </div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                    <div>
                                        <Label htmlFor="kitchen">Kitchen</Label>
                                        <Input
                                            id="kitchen"
                                            type="number"
                                            value={kitchen}
                                            onChange={(e) => setKitchen(e.target.value)}
                                            placeholder="1"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="livingRoom">Living Room</Label>
                                        <Input
                                            id="livingRoom"
                                            type="number"
                                            step="1"
                                            value={livingRoom}
                                            onChange={(e) => setLivingRoom(e.target.value)}
                                            placeholder="1"
                                            min="0"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label>Additional Areas</Label>
                                    <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                                        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                                            <input
                                                type="checkbox"
                                                checked={hasPatio}
                                                onChange={(e) => setHasPatio(e.target.checked)}
                                                style={{ width: "16px", height: "16px", accentColor: "#7c3aed" }}
                                            />
                                            <span style={{ fontSize: "14px", color: "#374151" }}>Patio</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="otherDetails">Other Details</Label>
                                    <textarea
                                        id="otherDetails"
                                        value={otherDetails}
                                        onChange={(e) => setOtherDetails(e.target.value)}
                                        placeholder="Any other details about your home..."
                                        style={{
                                            width: "100%",
                                            padding: "8px 12px",
                                            borderRadius: "6px",
                                            border: "1px solid #d1d5db",
                                            fontSize: "14px",
                                            marginTop: "4px",
                                            minHeight: "80px",
                                            fontFamily: "inherit",
                                            backgroundColor: "white",
                                            color: "#111827"
                                        }}
                                    />
                                </div>

                                <div style={{
                                    padding: "16px",
                                    backgroundColor: "#faf5ff",
                                    borderRadius: "8px",
                                    border: "1px solid #e9d5ff"
                                }}>
                                    <p style={{
                                        color: "#581c87",
                                        fontSize: "12px",
                                        fontWeight: "600",
                                        marginBottom: "8px"
                                    }}>What's next?</p>
                                    <p style={{ color: "#7c3aed", fontSize: "12px", lineHeight: "1.5" }}>
                                        You and your roommates will each complete a quick preference
                                        survey. Once everyone is done, our AI will generate a fair chore
                                        schedule for your household.
                                    </p>
                                </div>

                                <Button
                                    onClick={handleContinueToSurvey}
                                    style={{
                                        width: "100%",
                                        opacity: 1,
                                        cursor: "pointer"
                                    }}
                                >
                                    <Sparkles style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                                    Continue to Survey
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Custom Back Button Component
function BackButton({ onClick, children }) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "8px 16px",
                marginBottom: "16px",
                backgroundColor: isHovered ? "#faf5ff" : "transparent",
                color: "#7c3aed",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
                transition: "background-color 0.2s",
                fontFamily: "system-ui, -apple-system, sans-serif"
            }}
        >
            {children}
        </button>
    );
}

// Custom Remove Button Component
function RemoveButton({ onClick, children }) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                width: "24px",
                height: "24px",
                padding: "0",
                backgroundColor: isHovered ? "#fef2f2" : "transparent",
                color: "#dc2626",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background-color 0.2s"
            }}
        >
            {children}
        </button>
    );
}

// Custom Select Button Component
function SelectButton({ selected, onClick, children }) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                padding: "12px 16px",
                backgroundColor: selected ? "#faf5ff" : (isHovered ? "#f9fafb" : "white"),
                border: selected ? "2px solid #7c3aed" : "2px solid #d1d5db",
                color: selected ? "#7c3aed" : "#111827",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
                transition: "all 0.2s",
                fontFamily: "system-ui, -apple-system, sans-serif"
            }}
        >
            {children}
        </button>
    );
}