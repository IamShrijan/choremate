import React from "react";

const Label = ({ htmlFor, children, style, ...props }) => {
    const labelStyles = {
        fontSize: "14px",
        fontWeight: "600",
        color: "#374151",
        marginBottom: "8px",
        display: "block",
        fontFamily: "system-ui, -apple-system, sans-serif"
    };

    return (
        <label htmlFor={htmlFor} style={{ ...labelStyles, ...style }} {...props}>
            {children}
        </label>
    );
};

export default Label;