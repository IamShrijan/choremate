import React from 'react';

export function Slider({ value, onValueChange, min = 0, max = 100, step = 1, style }) {
    const handleChange = (e) => {
        onValueChange([parseFloat(e.target.value)]);
    };

    const val = Array.isArray(value) ? value[0] : value;

    return (
        <div style={{ ...style, display: 'flex', alignItems: 'center' }}>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={val}
                onChange={handleChange}
                style={{
                    width: '100%',
                    accentColor: '#7c3aed',
                    height: '6px',
                    borderRadius: '3px',
                    outline: 'none',
                    cursor: 'pointer'
                }}
            />
        </div>
    );
}