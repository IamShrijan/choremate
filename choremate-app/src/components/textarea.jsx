import * as React from "react";

export function Textarea({ style, ...props }) {
    return (
        <textarea
            style={{
                resize: "none",
                border: "1px solid #d1d5db",
                width: "100%",
                minHeight: "64px",
                borderRadius: "6px",
                backgroundColor: "white",
                padding: "8px 12px",
                fontSize: "14px",
                lineHeight: "1.5",
                transition: "border-color 0.2s, box-shadow 0.2s",
                outline: "none",
                fontFamily: "inherit",
                ...style,
            }}
            onFocus={(e) => {
                e.currentTarget.style.borderColor = "#7c3aed";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.1)";
            }}
            onBlur={(e) => {
                e.currentTarget.style.borderColor = "#d1d5db";
                e.currentTarget.style.boxShadow = "none";
            }}
            {...props}
        />
    );
}