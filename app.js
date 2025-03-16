const { useState, useEffect, useRef, useMemo, useSyncExternalStore } = React;
const { createRoot } = ReactDOM;

// Initialize WebSimSocket connection
const room = new WebsimSocket();

const App = () => {
    const [activeTab, setActiveTab] = useState('draw');
    const [selectedColor, setSelectedColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(5);
    const [isDrawing, setIsDrawing] = useState(false);
    const [description, setDescription] = useState('');
    const [generatedImageUrl, setGeneratedImageUrl] = useState('');
    const [analyzerPrompt, setAnalyzerPrompt] = useState('');
    const [generatorPrompt, setGeneratorPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isRemixing, setIsRemixing] = useState(false);
    const [remixSourceHaircut, setRemixSourceHaircut] = useState(null);
    const [drawingVectors, setDrawingVectors] = useState([]);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [customColor, setCustomColor] = useState('#000000');
    const [currentTool, setCurrentTool] = useState('brush');
    const [selectedHaircut, setSelectedHaircut] = useState(null);

    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const canvasSizeRef = useRef({ width: 500, height: 500 });
    const colorPickerRef = useRef(null);
    
    const haircuts = useSyncExternalStore(
        room.collection('haircut').subscribe,
        () => room.collection('haircut').getList().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    );

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
            
            // If we have vectors, redraw them
            if (drawingVectors.length > 0) {
                redrawVectors();
            }
        }
    }, [activeTab, isRemixing]);

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

    const floodFill = (startX, startY, fillColor) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;
        
        // Ensure coordinates are within bounds
        startX = Math.max(0, Math.min(Math.floor(startX), width - 1));
        startY = Math.max(0, Math.min(Math.floor(startY), height - 1));
        
        // Get the color we're filling
        const targetColor = getColorAt(imageData, startX, startY);
        
        // Don't fill if target color is the same as fill color
        const rgbFillColor = hexToRgb(fillColor);
        if (colorsMatch(targetColor, rgbFillColor)) {
            return;
        }
        
        // Stack for flood fill algorithm (x, y coordinates)
        const stack = [{x: startX, y: startY}];
        const maxStackSize = width * height; // Safety limit
        const visited = new Set(); // Track visited pixels
        const pixelKey = (x, y) => `${x},${y}`;
        
        let iterations = 0;
        const maxIterations = width * height; // Safety limit
        
        while (stack.length > 0 && iterations < maxIterations) {
            iterations++;
            const {x, y} = stack.pop();
            const key = pixelKey(x, y);
            
            // Skip already visited pixels
            if (visited.has(key)) continue;
            visited.add(key);
            
            // Skip if out of bounds
            if (x < 0 || y < 0 || x >= width || y >= height) {
                continue;
            }
            
            const currentIndex = (y * width + x) * 4;
            
            // Skip if the color doesn't match target
            if (!colorsMatch([data[currentIndex], data[currentIndex + 1], data[currentIndex + 2], data[currentIndex + 3]], targetColor)) {
                continue;
            }
            
            // Fill the pixel
            data[currentIndex] = rgbFillColor.r;
            data[currentIndex + 1] = rgbFillColor.g;
            data[currentIndex + 2] = rgbFillColor.b;
            data[currentIndex + 3] = 255; // Full alpha
            
            // Add adjacent pixels to stack (if stack isn't too large)
            if (stack.length < maxStackSize) {
                if (x + 1 < width) stack.push({x: x + 1, y: y});
                if (x - 1 >= 0) stack.push({x: x - 1, y: y});
                if (y + 1 < height) stack.push({x: x, y: y + 1});
                if (y - 1 >= 0) stack.push({x: x, y: y - 1});
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Add the fill operation to drawing vectors for later replay
        setDrawingVectors(prev => [
            ...prev, 
            {
                type: 'fill',
                point: {x: startX, y: startY},
                color: fillColor,
                targetColor: targetColor
            }
        ]);
    };

    const getColorAt = (imageData, x, y) => {
        const index = (y * imageData.width + x) * 4;
        return [
            imageData.data[index],
            imageData.data[index + 1],
            imageData.data[index + 2],
            imageData.data[index + 3]
        ];
    };

    const hexToRgb = (hex) => {
        // Handle when hex is already an RGB object
        if (typeof hex === 'object' && hex.r !== undefined) {
            return hex;
        }
        
        // Ensure hex is a string
        hex = String(hex);
        
        // Remove # if present
        hex = hex.replace ? hex.replace('#', '') : '';
        
        // Convert 3-digit hex to 6-digit
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        
        // Parse the hex values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return {r, g, b};
    };

    const colorsMatch = (color1, color2, tolerance = 10) => {
        return Math.abs(color1[0] - color2[0]) <= tolerance &&
               Math.abs(color1[1] - color2[1]) <= tolerance &&
               Math.abs(color1[2] - color2[2]) <= tolerance &&
               Math.abs(color1[3] - color2[3]) <= tolerance;
    };

    const colorOptions = [
        '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', 
        '#ffff00', '#00ffff', '#ff00ff', '#a52a2a', '#808080'
    ];

    const startDrawing = ({ nativeEvent }) => {
        const { offsetX, offsetY } = nativeEvent;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (offsetX) * scaleX;
        const y = (offsetY) * scaleY;
        
        // If using fill bucket, perform flood fill and return
        if (currentTool === 'fill') {
            floodFill(Math.floor(x), Math.floor(y), hexToRgb(selectedColor));
            return;
        }
        
        contextRef.current.beginPath();
        contextRef.current.moveTo(x, y);
        setIsDrawing(true);
        
        // Start a new vector
        setDrawingVectors(prev => [
            ...prev, 
            {
                type: 'brush',
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

    const clearCanvas = () => {
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
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        // Clear canvas first
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Redraw all vectors
        drawingVectors.forEach(vector => {
            if (vector.type === 'fill') {
                // For fill operations, we need to redo the flood fill
                floodFill(Math.floor(vector.point.x), Math.floor(vector.point.y), vector.color);
                return;
            }
            
            // For brush strokes
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

    const analyzeAndGenerateHaircut = async () => {
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

    const openHaircutModal = (haircut) => {
        setSelectedHaircut(haircut);
    };

    const closeModal = () => {
        setSelectedHaircut(null);
    };

    const remixHaircut = (haircut) => {
        try {
            console.log('Starting remix of haircut:', haircut.id);
            console.log('Haircut data:', haircut);
            
            // Validate vectors data exists
            if (!haircut.vectors) {
                throw new Error('No vector data available for this haircut');
            }
            
            const vectors = JSON.parse(haircut.vectors || '[]');
            console.log('Parsed vectors data:', vectors);
            
            // Wait for state updates to complete before continuing
            setTimeout(() => {
                setDrawingVectors(vectors);
                setIsRemixing(true);
                setRemixSourceHaircut(haircut);
                setActiveTab('draw');
                setSelectedHaircut(null);
                setDescription('');
                setGeneratedImageUrl('');
                
                // Force redraw after state updates
                setTimeout(() => {
                    redrawVectors();
                    console.log('Canvas redrawn with vectors for remixing');
                }, 100);
                
                console.log('Remix setup complete - remixing enabled with source haircut ID:', haircut.id);
            }, 50);
        } catch (error) {
            console.error('Error remixing haircut:', error);
            alert('Sorry, this haircut cannot be remixed. Error: ' + error.message);
        }
    };

    const reloadRemix = () => {
        console.log('Reloading remix...');
        if (remixSourceHaircut && remixSourceHaircut.vectors) {
            try {
                const vectors = JSON.parse(remixSourceHaircut.vectors || '[]');
                setDrawingVectors(vectors);
                // Force redraw
                setTimeout(() => {
                    redrawVectors();
                    console.log('Canvas redrawn with vectors for remixing');
                }, 100);
            } catch (error) {
                console.error('Error reloading remix:', error);
                alert('Failed to reload remix: ' + error.message);
            }
        } else {
            alert('No remix data available to reload');
        }
    };

    return (
        <div className="container">
            <div className="header">
                <h1>This Haircut Does Not Exist</h1>
                <p>Draw a haircut or abstract shape and let AI interpret it as a unique hairstyle!</p>
            </div>
            
            <div className="tabs">
                <button 
                    className={`tab ${activeTab === 'draw' ? 'active' : ''}`}
                    onClick={() => setActiveTab('draw')}
                >
                    <i className="fas fa-paint-brush"></i> Create
                </button>
                <button 
                    className={`tab ${activeTab === 'gallery' ? 'active' : ''}`}
                    onClick={() => setActiveTab('gallery')}
                >
                    <i className="fas fa-images"></i> Gallery
                </button>
            </div>
            
            {activeTab === 'draw' && (
                <>
                    <div className="drawing-container">
                        <div className="title-section">
                            <h2>Draw Your Haircut</h2>
                            <p>Use your imagination to create a unique hairstyle!</p>
                        </div>
                        
                        <div className="canvas-controls">
                            <div className="tools-panel">
                                <div className="tool-buttons">
                                    <button 
                                        className={`tool-btn ${currentTool === 'brush' ? 'active' : ''}`}
                                        onClick={() => setCurrentTool('brush')}
                                        title="Brush Tool"
                                    >
                                        <i className="fas fa-paint-brush"></i>
                                    </button>
                                    <button 
                                        className={`tool-btn ${currentTool === 'fill' ? 'active' : ''}`}
                                        onClick={() => setCurrentTool('fill')}
                                        title="Fill Tool"
                                    >
                                        <i className="fas fa-fill-drip"></i>
                                    </button>
                                </div>
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
                                        disabled={currentTool === 'fill'}
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
                                        cursor: currentTool === 'brush' 
                                            ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='${brushSize}' width='${brushSize}'%3E%3Ccircle cx='${brushSize/2}' cy='${brushSize/2}' r='${brushSize/2}' fill='${encodeURIComponent(selectedColor)}'/%3E%3C/svg%3E") ${brushSize/2} ${brushSize/2}, crosshair`
                                            : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='20' width='20' viewBox='0 0 512 512'%3E%3Cpath fill='${encodeURIComponent(selectedColor)}' d='M502.63 217.06L294.94 9.37C288.69 3.12 280.5 0 272.31 0s-16.38 3.12-22.62 9.37l-81.58 81.58L81.93 4.77c-6.24-6.25-16.38-6.25-22.62 0L36.69 27.38c-6.24 6.25-6.24 16.38 0 22.63l86.19 86.18-94.76 94.76c-37.5 37.5-37.5 98.26 0 135.76l117.19 117.19c18.75 18.74 43.31 28.12 67.87 28.12 24.57 0 49.13-9.37 67.88-28.12l221.57-221.57c12.49-12.5 12.49-32.76 0-45.26zm-116.22 70.97H65.93c1.36-3.84 3.57-7.98 7.43-11.83l13.15-13.15 81.61-81.61 58.61 58.6c12.49 12.49 32.75 12.49 45.24 0 12.49-12.49 12.49-32.75 0-45.24l-58.61-58.6 58.95-58.95 162.45 162.44-48.35 48.34z'%3E%3C/path%3E%3C/svg%3E") 2 18, pointer`
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
                                <button onClick={reloadRemix} className="reload-remix-btn">
                                    <i className="fas fa-sync-alt"></i> Reload Remix
                                </button>
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
                        <div className="result-container">
                            <h2>Your Haircut</h2>
                            
                            <div className="result-columns">
                                <div className="description-column">
                                    <h3>Description</h3>
                                    <div className="description">
                                        {description}
                                    </div>
                                </div>
                                
                                {generatedImageUrl && (
                                    <div className="image-column">
                                        <h3>Generated Haircut</h3>
                                        <div className="image-wrapper">
                                            <img 
                                                src={generatedImageUrl} 
                                                alt="Generated haircut" 
                                                className="generated-image" 
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
            
            {activeTab === 'gallery' && (
                <div className="gallery">
                    {haircuts.map(haircut => (
                        <div 
                            key={haircut.id} 
                            className="gallery-item"
                        >
                            <img 
                                src={haircut.haircutUrl} 
                                alt="Generated haircut" 
                                onClick={() => openHaircutModal(haircut)}
                            />
                            <div className="content">
                                <div className="description-preview">
                                    {haircut.description.substring(0, 100)}...
                                </div>
                                <div className="gallery-actions">
                                    <div className="date">
                                        {new Date(haircut.created_at).toLocaleDateString()}
                                    </div>
                                    <button 
                                        className="remix-gallery-btn"
                                        onClick={() => remixHaircut(haircut)}
                                    >
                                        <i className="fas fa-remix"></i> Remix
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {selectedHaircut && (
                <div className="modal" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Haircut Details</h2>
                            <button className="modal-close" onClick={closeModal}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="modal-images">
                                <div className="image-card">
                                    <h3>Original Drawing</h3>
                                    <img 
                                        src={selectedHaircut.drawingUrl} 
                                        alt="Original drawing" 
                                        className="drawing"
                                    />
                                </div>
                                <div className="image-card">
                                    <h3>Generated Haircut</h3>
                                    <img 
                                        src={selectedHaircut.haircutUrl} 
                                        alt="Generated haircut" 
                                    />
                                </div>
                            </div>
                            {selectedHaircut.isRemix && (
                                <div className="remix-history">
                                    <h3>Remix History</h3>
                                    <div className="modal-images">
                                        <div className="image-card">
                                            <h3>Parent Drawing</h3>
                                            <img 
                                                src={selectedHaircut.originalDrawingUrl} 
                                                alt="Parent drawing" 
                                                className="drawing"
                                            />
                                        </div>
                                        <div className="image-card">
                                            <h3>Parent Haircut</h3>
                                            <img 
                                                src={selectedHaircut.originalHaircutUrl} 
                                                alt="Parent haircut" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="prompt-details">
                                <div className="prompt-section">
                                    <h3>LLM Prompts</h3>
                                    {selectedHaircut.userPromptText && (
                                        <div className="prompt-card">
                                            <h4>User Prompt</h4>
                                            <p>{selectedHaircut.userPromptText}</p>
                                        </div>
                                    )}
                                    {selectedHaircut.analyzerPrompt && (
                                        <div className="prompt-card">
                                            <h4>Analyzer System Prompt</h4>
                                            <p>{selectedHaircut.analyzerPrompt}</p>
                                        </div>
                                    )}
                                    {selectedHaircut.generatorPrompt && (
                                        <div className="prompt-card">
                                            <h4>Image Generation Prompt</h4>
                                            <p>{selectedHaircut.generatorPrompt}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="description">
                                <h3>Description</h3>
                                <p>{selectedHaircut.description}</p>
                            </div>
                            <div className="meta">
                                <p><i className="fas fa-user"></i> Created by: {selectedHaircut.username}</p>
                                <p><i className="fas fa-calendar-alt"></i> Date: {new Date(selectedHaircut.created_at).toLocaleString()}</p>
                                <button 
                                    className="remix-btn" 
                                    onClick={() => remixHaircut(selectedHaircut)}
                                >
                                    <i className="fas fa-remix"></i> Remix this Haircut
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = createRoot(document.getElementById('app'));
root.render(<App />);