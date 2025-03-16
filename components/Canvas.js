import React from 'react';
const { useState, useEffect, useRef } = React;

const Canvas = ({ 
    selectedColor, 
    brushSize, 
    drawingVectors, 
    setDrawingVectors, 
    isRemixing, 
    remixSourceHaircut 
}) => {
    const [isDrawing, setIsDrawing] = useState(false);
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const canvasSizeRef = useRef({ width: 500, height: 500 });

    // Initialize canvas
    useEffect(() => {
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = canvasSizeRef.current.width;
            canvas.height = canvasSizeRef.current.height;
            
            const context = canvas.getContext('2d');
            context.lineCap = 'round';
            context.strokeStyle = selectedColor;
            context.lineWidth = brushSize;
            contextRef.current = context;
            
            context.fillStyle = 'white';
            context.fillRect(0, 0, canvas.width, canvas.height);
        }
    }, []);

    // Update context when color or size changes
    useEffect(() => {
        if (contextRef.current) {
            contextRef.current.strokeStyle = selectedColor;
            contextRef.current.lineWidth = brushSize;
        }
    }, [selectedColor, brushSize]);

    // Handle redrawing vectors when remixing or vectors change
    useEffect(() => {
        if (canvasRef.current && drawingVectors.length > 0) {
            redrawVectors();
        }
    }, [drawingVectors]);

    const startDrawing = ({ nativeEvent }) => {
        const { offsetX, offsetY } = nativeEvent;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (offsetX) * scaleX;
        const y = (offsetY) * scaleY;
        
        contextRef.current.beginPath();
        contextRef.current.moveTo(x, y);
        setIsDrawing(true);
        
        // Start a new vector
        setDrawingVectors(prev => [
            ...prev, 
            {
                points: [{x, y}],
                color: selectedColor,
                size: brushSize
            }
        ]);
    };

    const draw = ({ nativeEvent }) => {
        if (!isDrawing) return;
        const { offsetX, offsetY } = nativeEvent;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (offsetX) * scaleX;
        const y = (offsetY) * scaleY;
        
        contextRef.current.lineTo(x, y);
        contextRef.current.stroke();
        
        // Add point to the current vector
        setDrawingVectors(prev => {
            const updatedVectors = [...prev];
            const currentVector = updatedVectors[updatedVectors.length - 1];
            currentVector.points.push({x, y});
            return updatedVectors;
        });
    };

    const stopDrawing = () => {
        contextRef.current.closePath();
        setIsDrawing(false);
    };

    const redrawVectors = () => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        // Clear canvas first
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Redraw all vectors
        drawingVectors.forEach(vector => {
            if (vector.points.length < 2) return;
            
            context.beginPath();
            context.strokeStyle = vector.color;
            context.lineWidth = vector.size;
            
            context.moveTo(vector.points[0].x, vector.points[0].y);
            
            for (let i = 1; i < vector.points.length; i++) {
                context.lineTo(vector.points[i].x, vector.points[i].y);
            }
            
            context.stroke();
        });
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        return canvas;
    };

    return (
        <div className="canvas-wrapper">
            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                style={{ 
                    width: '100%', 
                    height: '400px',
                    cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='${brushSize}' width='${brushSize}'%3E%3Ccircle cx='${brushSize/2}' cy='${brushSize/2}' r='${brushSize/2}' fill='${encodeURIComponent(selectedColor)}'/%3E%3C/svg%3E") ${brushSize/2} ${brushSize/2}, crosshair`
                }}
            />
        </div>
    );
}

export default Canvas;