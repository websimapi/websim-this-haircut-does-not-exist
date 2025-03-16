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
    const [selectedHaircut, setSelectedHaircut] = useState(null);
    
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
        
        // Clear canvas to white
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    useEffect(() => {
        if (contextRef.current) {
            contextRef.current.strokeStyle = selectedColor;
            contextRef.current.lineWidth = brushSize;
        }
    }, [selectedColor, brushSize]);

    const getMousePos = (canvas, evt) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    };

    const startDrawing = ({ nativeEvent }) => {
        const { x, y } = getMousePos(canvasRef.current, nativeEvent);
        contextRef.current.beginPath();
        contextRef.current.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = ({ nativeEvent }) => {
        if (!isDrawing) return;
        const { x, y } = getMousePos(canvasRef.current, nativeEvent);
        contextRef.current.lineTo(x, y);
        contextRef.current.stroke();
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
    };

    const analyzeDrawing = async () => {
        setIsAnalyzing(true);
        try {
            const canvas = canvasRef.current;
            const imageDataUrl = canvas.toDataURL('image/jpeg');
            
            const completion = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are a professional hair stylist with expertise in describing haircuts and styles. Given an image of a drawn haircut or abstract shape, describe what this would look like as an actual haircut in great detail. Focus on length, texture, color, styling techniques, and any distinctive features. Be creative and detailed."
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Describe this drawing as if it were a haircut or hairstyle. Be detailed and creative. If it's abstract, interpret what haircut it might represent."
                            },
                            {
                                type: "image_url",
                                image_url: { url: imageDataUrl }
                            }
                        ]
                    }
                ]
            });
            
            setDescription(completion.content);
        } catch (error) {
            console.error('Error analyzing drawing:', error);
            setDescription('Error analyzing the drawing. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const generateHaircutImage = async () => {
        if (!description) return;
        
        setIsGenerating(true);
        try {
            const result = await websim.imageGen({
                prompt: `Professional photograph of a person with the following haircut: ${description}. Professional salon photo, high quality, detailed hair texture, salon lighting.`,
                aspect_ratio: "1:1"
            });
            
            setGeneratedImageUrl(result.url);
            
            // Save to database
            const canvas = canvasRef.current;
            const drawingDataUrl = canvas.toDataURL('image/jpeg');
            
            // Upload drawing to get a permanent URL
            const drawingUrl = await websim.upload(
                dataURLtoFile(drawingDataUrl, 'drawing.jpg')
            );
            
            // Save to collection
            await room.collection('haircut').create({
                description,
                drawingUrl,
                haircutUrl: result.url
            });
            
        } catch (error) {
            console.error('Error generating haircut image:', error);
            alert('Error generating the haircut image. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };
    
    // Helper function to convert data URL to File object
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
                    Create
                </button>
                <button 
                    className={`tab ${activeTab === 'gallery' ? 'active' : ''}`}
                    onClick={() => setActiveTab('gallery')}
                >
                    Gallery
                </button>
            </div>
            
            {activeTab === 'draw' && (
                <>
                    <div className="drawing-container">
                        <div className="canvas-wrapper">
                            <canvas
                                ref={canvasRef}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                            />
                        </div>
                        
                        <div className="tools">
                            <button onClick={clearCanvas}>Clear</button>
                            <button 
                                onClick={analyzeDrawing}
                                disabled={isAnalyzing}
                            >
                                {isAnalyzing ? 'Analyzing...' : 'Analyze Drawing'}
                            </button>
                            <button 
                                onClick={generateHaircutImage}
                                disabled={!description || isGenerating}
                            >
                                {isGenerating ? 'Generating...' : 'Generate Haircut'}
                            </button>
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
                        
                        <div>
                            <label htmlFor="size">Brush Size: {brushSize}</label>
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
                    </div>
                    
                    {description && (
                        <div className="result-container">
                            <h2>Haircut Description</h2>
                            <div className="description">
                                {description}
                            </div>
                            
                            {generatedImageUrl && (
                                <>
                                    <h2>Generated Haircut</h2>
                                    <img 
                                        src={generatedImageUrl} 
                                        alt="Generated haircut" 
                                        className="generated-image" 
                                    />
                                </>
                            )}
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
                            onClick={() => openHaircutModal(haircut)}
                        >
                            <img src={haircut.haircutUrl} alt="Generated haircut" />
                            <div className="content">
                                <div className="description-preview">
                                    {haircut.description.substring(0, 100)}...
                                </div>
                                <div className="date">
                                    {new Date(haircut.created_at).toLocaleDateString()}
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
                                <img 
                                    src={selectedHaircut.drawingUrl} 
                                    alt="Original drawing" 
                                    className="drawing"
                                />
                                <img 
                                    src={selectedHaircut.haircutUrl} 
                                    alt="Generated haircut" 
                                />
                            </div>
                            <div className="description">
                                <h3>Description</h3>
                                <p>{selectedHaircut.description}</p>
                            </div>
                            <div className="meta">
                                <p>Created by: {selectedHaircut.username}</p>
                                <p>Date: {new Date(selectedHaircut.created_at).toLocaleString()}</p>
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