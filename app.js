import React from 'react';
import ReactDOM from 'react-dom';

const { useState, useEffect, useRef } = React;
const { createRoot } = ReactDOM;

import Canvas from './components/Canvas.js';
import ColorPicker from './components/ColorPicker.js';
import Gallery from './components/Gallery.js';
import Modal from './components/Modal.js';
import { dataURLtoFile } from './utils/helpers.js';
import HaircutService from './services/haircutService.js';

// Initialize WebSimSocket connection
const room = new WebsimSocket();

const App = () => {
    const [activeTab, setActiveTab] = useState('draw');
    const [selectedColor, setSelectedColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(5);
    const [description, setDescription] = useState('');
    const [generatedImageUrl, setGeneratedImageUrl] = useState('');
    const [analyzerPrompt, setAnalyzerPrompt] = useState('');
    const [generatorPrompt, setGeneratorPrompt] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRemixing, setIsRemixing] = useState(false);
    const [remixSourceHaircut, setRemixSourceHaircut] = useState(null);
    const [selectedHaircut, setSelectedHaircut] = useState(null);
    const [drawingVectors, setDrawingVectors] = useState([]);
    
    const canvasRef = useRef(null);

    // Clear the canvas with user confirmation
    const clearCanvas = () => {
        const confirmed = window.confirm('Are you sure you want to clear your drawing?');
        if (confirmed) {
            setDescription('');
            setGeneratedImageUrl('');
            setDrawingVectors([]);
            setIsRemixing(false);
            setRemixSourceHaircut(null);
        }
    };

    // Process the haircut
    const analyzeAndGenerateHaircut = async () => {
        setIsProcessing(true);
        setIsAnalyzing(true);
        
        try {
            const canvas = document.querySelector('canvas');
            if (!canvas) {
                throw new Error('Canvas not found');
            }
            
            const result = await HaircutService.analyzeAndGenerateHaircut(
                canvas, 
                drawingVectors, 
                isRemixing, 
                remixSourceHaircut
            );
            
            if (result.success) {
                setDescription(result.description);
                setGeneratedImageUrl(result.generatedImageUrl);
                setAnalyzerPrompt(result.analyzerPrompt);
                setGeneratorPrompt(result.generatorPrompt);
            } else {
                alert('Error analyzing or generating the haircut. Please try again.');
            }
        } catch (error) {
            console.error('Error in UI layer:', error);
            alert('Error processing haircut. Please try again.');
        } finally {
            setIsAnalyzing(false);
            setIsGenerating(false);
            setIsProcessing(false);
        }
    };

    // Open modal with haircut details
    const openHaircutModal = (haircut) => {
        setSelectedHaircut(haircut);
    };

    // Close modal
    const closeModal = () => {
        setSelectedHaircut(null);
    };

    // Set up remix
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
            
            // Important: Need to set these in sequence to avoid race conditions
            setActiveTab('draw');
            setSelectedHaircut(null);
            setDescription('');
            setGeneratedImageUrl('');
            
            // Set state with delayed execution to ensure proper ordering
            setTimeout(() => {
                setDrawingVectors(vectors);
                setIsRemixing(true);
                setRemixSourceHaircut(haircut);
                console.log('Remix setup complete - remixing enabled with source haircut ID:', haircut.id);
            }, 100);
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
                                <ColorPicker 
                                    selectedColor={selectedColor} 
                                    setSelectedColor={setSelectedColor} 
                                />
                            </div>
                        
                            <Canvas 
                                selectedColor={selectedColor}
                                brushSize={brushSize}
                                drawingVectors={drawingVectors}
                                setDrawingVectors={setDrawingVectors}
                                isRemixing={isRemixing}
                                remixSourceHaircut={remixSourceHaircut}
                                ref={canvasRef}
                            />
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
                <Gallery 
                    openHaircutModal={openHaircutModal} 
                    remixHaircut={remixHaircut} 
                />
            )}
            
            {selectedHaircut && (
                <Modal 
                    selectedHaircut={selectedHaircut} 
                    closeModal={closeModal} 
                    remixHaircut={remixHaircut} 
                />
            )}
        </div>
    );
};

const root = createRoot(document.getElementById('app'));
root.render(<App />);