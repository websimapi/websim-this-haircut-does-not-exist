import React, { useState, useEffect, useRef } from 'react';

const ColorPicker = ({ selectedColor, setSelectedColor }) => {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [customColor, setCustomColor] = useState('#000000');
    const colorPickerRef = useRef(null);
    
    const colorOptions = [
        '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', 
        '#ffff00', '#00ffff', '#ff00ff', '#a52a2a', '#808080'
    ];
    
    // Close color picker when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target)) {
                setShowColorPicker(false);
            }
        }
        
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);
    
    const handleCustomColorChange = (e) => {
        setCustomColor(e.target.value);
    };

    const applyCustomColor = () => {
        setSelectedColor(customColor);
        setShowColorPicker(false);
    };

    const toggleColorPicker = (e) => {
        e.stopPropagation();
        setShowColorPicker(!showColorPicker);
    };
    
    return (
        <div className="color-picker">
            {colorOptions.map(color => (
                <div
                    key={color}
                    className={`color-option ${selectedColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setSelectedColor(color)}
                />
            ))}
            <div ref={colorPickerRef} style={{ position: 'relative' }}>
                <div 
                    className={`rainbow-color-picker ${selectedColor !== '#000000' && !colorOptions.includes(selectedColor) ? 'selected' : ''}`}
                    onClick={toggleColorPicker}
                />
                {showColorPicker && (
                    <div className="color-picker-popup">
                        <input 
                            type="color" 
                            value={customColor}
                            onChange={handleCustomColorChange}
                        />
                        <div className="custom-color-input">
                            <button onClick={applyCustomColor}>Apply Color</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ColorPicker;