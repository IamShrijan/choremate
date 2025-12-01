import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import Button from "../components/button";
import Input from "../components/input";
import Label from "../components/label";
import { Card, CardContent } from "../components/card";
import { authAPI } from "../utils/api";

// Main LoginPage Component
export default function LoginPage({ onLogin = () => { } }) {
    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [hoveredCard, setHoveredCard] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    
    // Field-level validation errors
    const [fieldErrors, setFieldErrors] = useState({
        name: "",
        email: "",
        password: ""
    });

    // Email validation regex: must have @ and domain with at least 3 characters after dot
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{3,}$/;

    // Validate email format
    const validateEmail = (emailValue) => {
        if (!emailValue) {
            return "Email is required";
        }
        if (!emailRegex.test(emailValue)) {
            return "Please enter a valid email address (e.g., user@example.com)";
        }
        return "";
    };

    // Validate password
    const validatePassword = (passwordValue) => {
        if (!passwordValue) {
            return "Password is required";
        }
        if (passwordValue.length < 4) {
            return "Password must be at least 4 characters";
        }
        return "";
    };

    // Validate name (for signup)
    const validateName = (nameValue) => {
        if (!nameValue || nameValue.trim() === "") {
            return "Full name is required";
        }
        return "";
    };

    // Update field errors when values change
    const handleEmailChange = (e) => {
        const value = e.target.value;
        setEmail(value);
        setFieldErrors(prev => ({
            ...prev,
            email: validateEmail(value)
        }));
        setError(""); // Clear general error when user types
    };

    const handlePasswordChange = (e) => {
        const value = e.target.value;
        setPassword(value);
        setFieldErrors(prev => ({
            ...prev,
            password: validatePassword(value)
        }));
        setError(""); // Clear general error when user types
    };

    const handleNameChange = (e) => {
        const value = e.target.value;
        setName(value);
        setFieldErrors(prev => ({
            ...prev,
            name: validateName(value)
        }));
        setError(""); // Clear general error when user types
    };

    // Check if form is valid
    const isFormValid = () => {
        if (isSignup) {
            return (
                name.trim() !== "" &&
                email.trim() !== "" &&
                password.length >= 4 &&
                emailRegex.test(email) &&
                fieldErrors.name === "" &&
                fieldErrors.email === "" &&
                fieldErrors.password === ""
            );
        } else {
            return (
                email.trim() !== "" &&
                password.length >= 4 &&
                emailRegex.test(email) &&
                fieldErrors.email === "" &&
                fieldErrors.password === ""
            );
        }
    };

    const handleSubmit = async () => {
        setError("");
        
        // Validate all fields before submission
        const emailError = validateEmail(email);
        const passwordError = validatePassword(password);
        const nameError = isSignup ? validateName(name) : "";

        setFieldErrors({
            name: nameError,
            email: emailError,
            password: passwordError
        });

        // If any validation fails, don't submit
        if (emailError || passwordError || nameError) {
            setError("Please fix the errors above before submitting");
            return;
        }

        setLoading(true);

        try {
            if (isSignup) {
                await authAPI.signup(name, email, password);
                // After signup, automatically log in
                await authAPI.login(email, password);
            } else {
                await authAPI.login(email, password);
            }
            
            // On successful auth, call the onLogin callback
            onLogin(isSignup);
        } catch (err) {
            setError(err.message || "Authentication failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        // TODO: Implement Google OAuth
        setError("Google login not yet implemented");
    };

    const handleModeSwitch = (signupMode) => {
        setIsSignup(signupMode);
        setError("");
        setFieldErrors({ name: "", email: "", password: "" });
        setEmail("");
        setPassword("");
        setName("");
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(to bottom right, #faf5ff, #faf5ff, #f3e8ff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "system-ui, -apple-system, sans-serif"
        }}>
            <div style={{ width: "100%", maxWidth: "512px" }}>
                {/* Logo and Welcome */}
                <div style={{ textAlign: "center", marginBottom: "40px" }}>
                    <div style={{
                        width: "80px",
                        height: "80px",
                        background: "linear-gradient(to bottom right, #7c3aed, #6d28d9)",
                        borderRadius: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 20px",
                        boxShadow: "0 10px 15px rgba(0, 0, 0, 0.1)"
                    }}>
                        <Sparkles style={{ width: "40px", height: "40px", color: "white" }} strokeWidth={2} />
                    </div>
                    <h1 style={{
                        fontSize: "32px",
                        fontWeight: "bold",
                        color: "#111827",
                        marginBottom: "12px",
                        lineHeight: "1.2"
                    }}>
                        Welcome to <span style={{ color: "#7c3aed" }}>ChoreMate</span>
                    </h1>
                    <p style={{
                        color: "#6b7280",
                        fontSize: "16px",
                        lineHeight: "1.6",
                        maxWidth: "448px",
                        margin: "0 auto"
                    }}>
                        Making household chores collaborative, fair, and actually enjoyable for shared living spaces
                    </p>
                </div>

                {/* Feature Cards */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "20px",
                    marginBottom: "40px",
                    maxWidth: "1000px",
                    margin: "0 auto 40px"
                }}>
                    <Card
                        style={{ cursor: "pointer", transition: "all 0.3s ease" }}
                        onMouseEnter={() => setHoveredCard(1)}
                        onMouseLeave={() => setHoveredCard(null)}
                    >
                        <CardContent style={{ padding: "12px", textAlign: "center" }}>
                            <div style={{
                                width: "48px",
                                height: "48px",
                                backgroundColor: "#f3e8ff",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 8px"
                            }}>
                                <Sparkles style={{ width: "24px", height: "24px", color: "#7c3aed" }} strokeWidth={2} />
                            </div>
                            <p style={{
                                color: "#111827",
                                fontSize: "14px",
                                fontWeight: "400",
                                marginBottom: "4px",
                                lineHeight: "1.2"
                            }}>Fair Distribution</p>
                            <p style={{
                                color: "#6b7280",
                                fontSize: "12px",
                                lineHeight: "1.4",
                                opacity: hoveredCard === 1 ? 1 : 0,
                                maxHeight: hoveredCard === 1 ? "100px" : 0,
                                overflow: "hidden",
                                transition: "opacity 0.3s ease, max-height 0.3s ease"
                            }}>
                                AI-powered scheduling that respects everyone's preferences
                            </p>
                        </CardContent>
                    </Card>

                    <Card
                        style={{ cursor: "pointer", transition: "all 0.3s ease" }}
                        onMouseEnter={() => setHoveredCard(2)}
                        onMouseLeave={() => setHoveredCard(null)}
                    >
                        <CardContent style={{ padding: "12px", textAlign: "center" }}>
                            <div style={{
                                width: "48px",
                                height: "48px",
                                backgroundColor: "#cffafe",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 8px"
                            }}>
                                <Sparkles style={{ width: "24px", height: "24px", color: "#0891b2" }} strokeWidth={2} />
                            </div>
                            <p style={{
                                color: "#111827",
                                fontSize: "14px",
                                fontWeight: "400",
                                marginBottom: "4px",
                                lineHeight: "1.2"
                            }}>Flexible Schedules</p>
                            <p style={{
                                color: "#6b7280",
                                fontSize: "12px",
                                lineHeight: "1.4",
                                opacity: hoveredCard === 2 ? 1 : 0,
                                maxHeight: hoveredCard === 2 ? "100px" : 0,
                                overflow: "hidden",
                                transition: "opacity 0.3s ease, max-height 0.3s ease"
                            }}>
                                Swap, reschedule, and delegate tasks naturally
                            </p>
                        </CardContent>
                    </Card>

                    <Card
                        style={{ cursor: "pointer", transition: "all 0.3s ease" }}
                        onMouseEnter={() => setHoveredCard(3)}
                        onMouseLeave={() => setHoveredCard(null)}
                    >
                        <CardContent style={{ padding: "12px", textAlign: "center" }}>
                            <div style={{
                                width: "48px",
                                height: "48px",
                                backgroundColor: "#dcfce7",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 8px"
                            }}>
                                <Sparkles style={{ width: "24px", height: "24px", color: "#16a34a" }} strokeWidth={2} />
                            </div>
                            <p style={{
                                color: "#111827",
                                fontSize: "14px",
                                fontWeight: "400",
                                marginBottom: "4px",
                                lineHeight: "1.2"
                            }}>Zero Nagging</p>
                            <p style={{
                                color: "#6b7280",
                                fontSize: "12px",
                                lineHeight: "1.4",
                                opacity: hoveredCard === 3 ? 1 : 0,
                                maxHeight: hoveredCard === 3 ? "100px" : 0,
                                overflow: "hidden",
                                transition: "opacity 0.3s ease, max-height 0.3s ease"
                            }}>
                                Gentle reminders and celebrations, not demands
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Login/Signup Form */}
                <Card style={{ boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)" }}>
                    <CardContent style={{ padding: "32px" }}>
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

                        <div style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
                            <Button
                                variant={!isSignup ? "default" : "outline"}
                                style={{ flex: 1 }}
                                onClick={() => handleModeSwitch(false)}
                                disabled={loading}
                            >
                                Login
                            </Button>
                            <Button
                                variant={isSignup ? "default" : "outline"}
                                style={{ flex: 1 }}
                                onClick={() => handleModeSwitch(true)}
                                disabled={loading}
                            >
                                Sign Up
                            </Button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                            {isSignup && (
                                <div>
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input
                                        id="name"
                                        type="text"
                                        value={name}
                                        onChange={handleNameChange}
                                        placeholder="John Doe"
                                        disabled={loading}
                                        style={{
                                            borderColor: fieldErrors.name ? "#dc2626" : undefined
                                        }}
                                    />
                                    {fieldErrors.name && (
                                        <p style={{
                                            color: "#dc2626",
                                            fontSize: "12px",
                                            marginTop: "4px",
                                            marginBottom: 0
                                        }}>
                                            {fieldErrors.name}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div>
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={handleEmailChange}
                                    placeholder="you@example.com"
                                    disabled={loading}
                                    style={{
                                        borderColor: fieldErrors.email ? "#dc2626" : undefined
                                    }}
                                />
                                {fieldErrors.email && (
                                    <p style={{
                                        color: "#dc2626",
                                        fontSize: "12px",
                                        marginTop: "4px",
                                        marginBottom: 0
                                    }}>
                                        {fieldErrors.email}
                                    </p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={handlePasswordChange}
                                    placeholder="••••••••"
                                    disabled={loading}
                                    style={{
                                        borderColor: fieldErrors.password ? "#dc2626" : undefined
                                    }}
                                />
                                {fieldErrors.password && (
                                    <p style={{
                                        color: "#dc2626",
                                        fontSize: "12px",
                                        marginTop: "4px",
                                        marginBottom: 0
                                    }}>
                                        {fieldErrors.password}
                                    </p>
                                )}
                                {!fieldErrors.password && password.length > 0 && password.length < 4 && (
                                    <p style={{
                                        color: "#f59e0b",
                                        fontSize: "12px",
                                        marginTop: "4px",
                                        marginBottom: 0
                                    }}>
                                        Password must be at least 4 characters
                                    </p>
                                )}
                            </div>

                            <Button
                                onClick={handleSubmit}
                                style={{ 
                                    width: "100%", 
                                    marginTop: "8px",
                                    opacity: isFormValid() ? 1 : 0.6,
                                    cursor: isFormValid() ? "pointer" : "not-allowed"
                                }}
                                disabled={loading || !isFormValid()}
                            >
                                {loading ? "Please wait..." : (isSignup ? "Create Account" : "Sign In")}
                            </Button>
                        </div>

                        <div style={{
                            position: "relative",
                            margin: "32px 0",
                            textAlign: "center"
                        }}>
                            <div style={{
                                position: "absolute",
                                top: "50%",
                                left: 0,
                                right: 0,
                                borderTop: "1px solid #e5e7eb"
                            }}></div>
                            <span style={{
                                position: "relative",
                                backgroundColor: "white",
                                padding: "0 16px",
                                fontSize: "14px",
                                color: "#6b7280",
                                fontWeight: "500"
                            }}>Or continue with</span>
                        </div>

                        <Button
                            variant="outline"
                            style={{ width: "100%" }}
                            onClick={handleGoogleLogin}
                            disabled={loading}
                        >
                            <svg style={{ width: "20px", height: "20px", marginRight: "10px" }} viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            Continue with Google
                        </Button>
                    </CardContent>
                </Card>

                <p style={{
                    textAlign: "center",
                    color: "#6b7280",
                    fontSize: "14px",
                    marginTop: "24px",
                    fontWeight: "500"
                }}>
                    Perfect for roommates, graduate students, and shared living spaces
                </p>
            </div>
        </div>
    );
}