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
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedHaircut, setSelectedHaircut] = useState(null);
    const [drawingVectors, setDrawingVectors] = useState([]);
    const [isRemixing, setIsRemixing] = useState(false);
    const [originalHaircutUrl, setOriginalHaircutUrl] = useState('');
    const [originalDescription, setOriginalDescription] = useState('');
    
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const canvasSizeRef = useRef({ width: 500, height: 500 });
    
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
    }, [isRemixing]);

    useEffect(() => {
        if (contextRef.current) {
            contextRef.current.strokeStyle = selectedColor;
            contextRef.current.lineWidth = brushSize;
        }
    }, [selectedColor, brushSize]);

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

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        setDescription('');
        setGeneratedImageUrl('');
        setDrawingVectors([]);
        setIsRemixing(false);
        setOriginalHaircutUrl('');
        setOriginalDescription('');
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

    const analyzeAndGenerateHaircut = async () => {
        setIsProcessing(true);
        setIsAnalyzing(true);
        try {
            const canvas = canvasRef.current;
            const imageDataUrl = canvas.toDataURL('image/jpeg');
            
            let promptContent = [
                {
                    type: "text",
                    text: "Describe this drawing as if it were a haircut or hairstyle. Be detailed and creative. If it's abstract, interpret what haircut it might represent."
                },
                {
                    type: "image_url",
                    image_url: { url: imageDataUrl }
                }
            ];
            
            // Add original haircut context if remixing
            if (isRemixing && originalHaircutUrl) {
                promptContent = [
                    {
                        type: "text",
                        text: `I'm remixing a haircut. This is a new drawing combined with a previous design.
The previous haircut was described as: "${originalDescription}"
Please analyze my new drawing in context with the previous design and create a new combined haircut description.`
                    },
                    {
                        type: "image_url",
                        image_url: { url: imageDataUrl }
                    },
                    {
                        type: "image_url",
                        image_url: { url: originalHaircutUrl }
                    }
                ];
            }

            const completion = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are a professional hair stylist with expertise in describing haircuts and styles. Given an image of a drawn haircut or abstract shape, describe what this would look like as an actual haircut in great detail. Focus on length, texture, color, styling techniques, and any distinctive features. Be creative and detailed."
                    },
                    {
                        role: "user",
                        content: promptContent
                    }
                ]
            });
            
            setDescription(completion.content);
            setIsAnalyzing(false);
            setIsGenerating(true);
            
            // Now generate the image
            const result = await websim.imageGen({
                prompt: `Professional photograph of a person with the following haircut: ${completion.content}. Professional salon photo, high quality, detailed hair texture, salon lighting.`,
                aspect_ratio: "1:1"
            });
            
            setGeneratedImageUrl(result.url);
            
            const drawingDataUrl = canvas.toDataURL('image/jpeg');
            
            const drawingUrl = await websim.upload(
                dataURLtoFile(drawingDataUrl, 'drawing.jpg')
            );
            
            // Store additional remixing data if this is a remix
            const remixData = isRemixing ? {
                isRemix: true,
                originalHaircutUrl,
                originalDescription
            } : {};
            
            await room.collection('haircut').create({
                description: completion.content,
                drawingUrl,
                haircutUrl: result.url,
                vectors: JSON.stringify(drawingVectors),
                ...remixData
            });
            
        } catch (error) {
            console.error('Error processing haircut:', error);
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
            const vectors = JSON.parse(haircut.vectors || '[]');
            setDrawingVectors(vectors);
            setIsRemixing(true);
            setActiveTab('draw');
            setSelectedHaircut(null);
            setDescription('');
            setGeneratedImageUrl('');
            setOriginalHaircutUrl(haircut.haircutUrl);
            setOriginalDescription(haircut.description);
        } catch (error) {
            console.error('Error remixing haircut:', error);
            alert('Sorry, this haircut cannot be remixed.');
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
                                {selectedHaircut.isRemix && selectedHaircut.originalHaircutUrl && (
                                    <div className="image-card">
                                        <h3>Remixed From</h3>
                                        <img 
                                            src={selectedHaircut.originalHaircutUrl} 
                                            alt="Original haircut" 
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="description">
                                <h3>Description</h3>
                                <p>{selectedHaircut.description}</p>
                                {selectedHaircut.isRemix && selectedHaircut.originalDescription && (
                                    <div className="original-description">
                                        <h4>Original Description:</h4>
                                        <p>{selectedHaircut.originalDescription}</p>
                                    </div>
                                )}
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