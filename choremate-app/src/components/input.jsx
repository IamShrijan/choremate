import React, { useState } from "react";

const Input = ({ type, value, onChange, placeholder, id, style, ...props }) => {
    const [isFocused, setIsFocused] = useState(false);

    const inputStyles = {
        display: "flex",
        height: "48px",
        width: "100%",
        borderRadius: "8px",
        border: isFocused ? "2px solid #7c3aed" : "1px solid #d1d5db",
        backgroundColor: "white",
        padding: "12px 16px",
        fontSize: "14px",
        color: "#111827",
        transition: "all 0.2s",
        outline: "none",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box"
    };

    return (
        <input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            style={{ ...inputStyles, ...style }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
        />
    );
};

export default Input;