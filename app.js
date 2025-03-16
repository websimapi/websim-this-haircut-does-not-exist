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
    const [selectedHaircut, setSelectedHaircut] = useState(null);
    const [drawingVectors, setDrawingVectors] = useState([]);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [customColor, setCustomColor] = useState('#000000');
    
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const canvasSizeRef = useRef({ width: 500, height: 500 });
    const colorPickerRef = useRef(null);
    
    const haircuts = useSyncExternalStore(
        room.collection('haircut').subscribe,
        () => room.collection('haircut').getList().reverse()
    );

    useEffect(() => {
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
        
        // If we're remixing, redraw the previous vectors
        if (isRemixing && drawingVectors.length > 0) {
            redrawVectors();
        }
    }, [isRemixing, drawingVectors]);

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
        const { offsetX, offsetY } = nativeEvent;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        let x, y;
        
        // Handle different event types (touch vs mouse)
        if (nativeEvent.type === 'touchstart') {
            const touch = nativeEvent.touches[0];
            x = (touch.clientX - rect.left) * scaleX;
            y = (touch.clientY - rect.top) * scaleY;
        } else {
            x = offsetX * scaleX;
            y = offsetY * scaleY;
        }
        
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
        
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        let x, y;
        
        // Handle different event types (touch vs mouse)
        if (nativeEvent.type === 'touchmove') {
            nativeEvent.preventDefault(); // Prevent scrolling on touch devices
            const touch = nativeEvent.touches[0];
            x = (touch.clientX - rect.left) * scaleX;
            y = (touch.clientY - rect.top) * scaleY;
        } else {
            const { offsetX, offsetY } = nativeEvent;
            x = offsetX * scaleX;
            y = offsetY * scaleY;
        }
        
        contextRef.current.lineTo(x, y);
        contextRef.current.stroke();
        
        // Add point to the current vector
        setDrawingVectors(prev => {
            const updatedVectors = [...prev];
            if (updatedVectors.length > 0) {
                const currentVector = updatedVectors[updatedVectors.length - 1];
                currentVector.points.push({x, y});
                return updatedVectors;
            }
            return prev;
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
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
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