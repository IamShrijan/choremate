import React from "react";

export const Card = ({ children, style, ...props }) => {
    const cardStyles = {
        borderRadius: "16px",
        border: "1px solid #e5e7eb",
        backgroundColor: "white",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
    };

    return (
        <div style={{ ...cardStyles, ...style }} {...props}>
            {children}
        </div>
    );
};

export const CardContent = ({ children, style, ...props }) => {
    const contentStyles = {
        padding: "24px"
    };

    return (
        <div style={{ ...contentStyles, ...style }} {...props}>
            {children}
        </div>
    );
};