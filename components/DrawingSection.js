import React, { useState, useEffect, useRef } from 'react';

const DrawingSection = ({ 
    isRemixing, 
    setIsRemixing,
    remixSourceHaircut, 
    setRemixSourceHaircut,
    drawingVectors,
    setDrawingVectors
}) => {
    const [selectedColor, setSelectedColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(5);
    const [isDrawing, setIsDrawing] = useState(false);
    const [description, setDescription] = useState('');
    const [generatedImageUrl, setGeneratedImageUrl] = useState('');
    const [analyzerPrompt, setAnalyzerPrompt] = useState('');
    const [generatorPrompt, setGeneratorPrompt] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [customColor, setCustomColor] = useState('#000000');
    
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const canvasSizeRef = useRef({ width: 500, height: 500 });
    const colorPickerRef = useRef(null);
    const canvasInitializedRef = useRef(false);

    useEffect(() => {
        initializeCanvas();
    }, []);

    // Re-initialize when vectors change (for remixing)
    useEffect(() => {
        if (drawingVectors.length > 0 && canvasInitializedRef.current) {
            redrawVectors();
        }
    }, [drawingVectors]);

    const initializeCanvas = () => {
        if (!canvasRef.current) return;
        
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
        
        canvasInitializedRef.current = true;
        
        // If we have vectors, redraw them
        if (drawingVectors.length > 0) {
            redrawVectors();
        }
    };

    useEffect(() => {
        if (contextRef.current) {
            contextRef.current.strokeStyle = selectedColor;
            contextRef.current.lineWidth = brushSize;
        }
    }, [selectedColor, brushSize]);

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

    const startDrawing = ({ nativeEvent }) => {
        if (!contextRef.current) return;
        
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
        if (!isDrawing || !contextRef.current) return;
        
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
        if (!contextRef.current) return;
        contextRef.current.closePath();
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        if (!canvasRef.current || !contextRef.current) return;
        
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        setDescription('');
        setGeneratedImageUrl('');
        setDrawingVectors([]);
        setIsRemixing(false);
        setRemixSourceHaircut(null);
    };

    const redrawVectors = () => {
        if (!canvasRef.current || !contextRef.current) return;
        
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        // Clear canvas first
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Redraw all vectors
        drawingVectors.forEach(vector => {
            if (!vector || !vector.points || vector.points.length < 2) return;
            
            context.beginPath();
            context.strokeStyle = vector.color || '#000000';
            context.lineWidth = vector.size || 5;
            
            context.moveTo(vector.points[0].x, vector.points[0].y);
            
            for (let i = 1; i < vector.points.length; i++) {
                context.lineTo(vector.points[i].x, vector.points[i].y);
            }
            
            context.stroke();
        });
    };

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

    const analyzeAndGenerateHaircut = async () => {
        if (!canvasRef.current) return;
        
        setIsProcessing(true);
        setIsAnalyzing(true);
        try {
            const canvas = canvasRef.current;
            const imageDataUrl = canvas.toDataURL('image/jpeg');
            
            console.log('Starting haircut analysis process');
            console.log('Is remixing:', isRemixing);
            if (isRemixing && remixSourceHaircut) {
                console.log('Remix source haircut data:', remixSourceHaircut);
            }
            
            let systemPrompt = "You are a professional hair stylist with expertise in describing haircuts and styles. Given an image of a drawn haircut or abstract shape, describe what this would look like as an actual haircut in great detail. Focus on length, texture, color, styling techniques, and any distinctive features. Be creative and detailed.";
            let userPrompt = [
                {
                    type: "text",
                    text: "Describe this drawing as if it were a haircut or hairstyle. Be detailed and creative. If it's abstract, interpret what haircut it might represent."
                },
                {
                    type: "image_url",
                    image_url: { url: imageDataUrl }
                }
            ];
            
            // If we're remixing, use a simplified prompt that focuses primarily on the new drawing
            if (isRemixing && remixSourceHaircut) {
                systemPrompt = "You are a professional hair stylist with expertise in creating new haircut designs. Focus primarily on the drawn image to create a detailed haircut description.";
                
                userPrompt = [
                    {
                        type: "text",
                        text: `I'm creating a new haircut based on this drawing. Please analyze the image and describe what this would look like as an actual haircut.
                        
                        Note: This is a remix of a previous haircut which had this description: "${remixSourceHaircut.description}".
                        
                        IMPORTANT: Focus primarily on the new drawing in the image - this should be the main influence for your description. The drawing should drive most of your description, though you can maintain some styling elements from the original description for context.`
                    },
                    {
                        type: "image_url",
                        image_url: { url: imageDataUrl }
                    }
                ];
                
                console.log('Using simplified remix prompt focusing on the new drawing');
            }
            
            console.log('Sending analysis request with prompt:', userPrompt);
            setAnalyzerPrompt(systemPrompt);
            
            const completion = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: userPrompt
                    }
                ]
            });
            
            console.log('Received haircut description:', completion.content.substring(0, 100) + '...');
            setDescription(completion.content);
            setIsAnalyzing(false);
            setIsGenerating(true);
            
            // Now generate the image
            console.log('Generating haircut image from description');
            let imagePrompt = `Professional photograph of a person with the following haircut: ${completion.content}. Professional salon photo, high quality, detailed hair texture, salon lighting.`;
            
            // Add minimal remix context to image generation prompt if applicable
            if (isRemixing && remixSourceHaircut) {
                imagePrompt = `Professional photograph of a person with the following haircut: ${completion.content}. 
                Professional salon photo, high quality, detailed hair texture, salon lighting.`;
            }
            
            setGeneratorPrompt(imagePrompt);
            
            const result = await websim.imageGen({
                prompt: imagePrompt,
                aspect_ratio: "1:1"
            });
            
            console.log('Received generated image URL:', result.url);
            setGeneratedImageUrl(result.url);
            
            const drawingDataUrl = canvas.toDataURL('image/jpeg');
            
            console.log('Uploading drawing to storage');
            const drawingUrl = await websim.upload(
                dataURLtoFile(drawingDataUrl, 'drawing.jpg')
            );
            console.log('Drawing uploaded, URL:', drawingUrl);
            
            // Create new haircut record with remix history if applicable
            let haircutData = {
                description: completion.content,
                drawingUrl,
                haircutUrl: result.url,
                vectors: JSON.stringify(drawingVectors),
                analyzerPrompt: systemPrompt,
                generatorPrompt: imagePrompt,
                userPromptText: typeof userPrompt[0].text === 'string' ? userPrompt[0].text : 'Custom drawing analysis'
            };
            
            // If this is a remix, include the parent haircut info
            if (isRemixing && remixSourceHaircut) {
                console.log('Adding remix information to record');
                haircutData.isRemix = true;
                haircutData.parentId = remixSourceHaircut.id;
                haircutData.originalDrawingUrl = remixSourceHaircut.drawingUrl;
                haircutData.originalHaircutUrl = remixSourceHaircut.haircutUrl;
            }
            
            console.log('Creating haircut record with data:', haircutData);
            await room.collection('haircut').create(haircutData);
            console.log('Haircut record created successfully');
            
        } catch (error) {
            console.error('Error processing haircut:', error);
            // More detailed error logging
            if (error.response) {
                console.error('Response error details:', error.response);
            }
            alert('Error analyzing or generating the haircut. Please try again.');
        } finally {
            setIsAnalyzing(false);
            setIsGenerating(false);
            setIsProcessing(false);
        }
    };

    const dataURLtoFile = (dataurl, filename) => {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    };

    const colorOptions = [
        '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', 
        '#ffff00', '#00ffff', '#ff00ff', '#a52a2a', '#808080'
    ];

    return (
        <>
            <div className="drawing-container">
                <div className="title-section">
                    <h2>Draw Your Haircut</h2>
                    <p>Use your imagination to create a unique hairstyle!</p>
                </div>
                
                <div className="canvas-controls">
                    <div className="tools-panel">
                        <div className="brush-controls">
                            <label htmlFor="size">Brush Size: {brushSize}px</label>
                            <input
                                type="range"
                                id="size"
                                className="size-slider"
                                min="1"
                                max="50"
                                value={brushSize}
                                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                            />
                        </div>
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
                    </div>
                
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
                </div>
                
                {isRemixing && remixSourceHaircut && (
                    <div className="remix-info">
                        <h3>Remixing Haircut</h3>
                        <div className="remix-images">
                            <div className="remix-image">
                                <img src={remixSourceHaircut.drawingUrl} alt="Original drawing" />
                                <p>Original Drawing</p>
                            </div>
                            <div className="remix-image">
                                <img src={remixSourceHaircut.haircutUrl} alt="Original haircut" />
                                <p>Original Haircut</p>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="action-buttons">
                    <button onClick={clearCanvas} className="clear-btn">
                        <i className="fas fa-trash-alt"></i> Clear
                    </button>
                    <button 
                        onClick={analyzeAndGenerateHaircut}
                        disabled={isProcessing}
                        className="generate-btn"
                    >
                        {isAnalyzing ? (
                            <><span className="spinner-small"></span> Analyzing...</>
                        ) : isGenerating ? (
                            <><span className="spinner-small"></span> Generating...</>
                        ) : (
                            <><i className="fas fa-magic"></i> Analyze & Generate Haircut</>
                        )}
                    </button>
                </div>
            </div>
            
            {description && (
                <ResultView 
                    description={description}
                    generatedImageUrl={generatedImageUrl}
                />
            )}
        </>
    );
};

export default DrawingSection;