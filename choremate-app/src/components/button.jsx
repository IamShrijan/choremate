import React, { useState } from "react";

const Button = ({ variant = "default", onClick, children, style, ...props }) => {
    const baseStyles = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: "600",
        transition: "all 0.2s",
        cursor: "pointer",
        padding: "12px 24px",
        border: "none",
        outline: "none",
        fontFamily: "system-ui, -apple-system, sans-serif"
    };

    const variants = {
        default: {
            backgroundColor: "#7c3aed",
            color: "white",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
        },
        outline: {
            backgroundColor: "white",
            color: "#374151",
            border: "2px solid #e5e7eb"
        }
    };

    const hoverStyles = variant === "default"
        ? { backgroundColor: "#6d28d9" }
        : { backgroundColor: "#f9fafb", borderColor: "#d1d5db" };

    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            style={{
                ...baseStyles,
                ...variants[variant],
                ...(isHovered ? hoverStyles : {}),
                ...style
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            {...props}
        >
            {children}
        </button>
    );
};

export default Button;