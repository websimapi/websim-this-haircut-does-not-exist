import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Header from './components/Header.js';
import Tabs from './components/Tabs.js';
import DrawingSection from './components/DrawingSection.js';
import Gallery from './components/Gallery.js';
import HaircutModal from './components/HaircutModal.js';
import { handleRemixHaircut } from './utils/haircutHelpers.js';

// Initialize WebSimSocket connection
const room = new WebsimSocket();

const App = () => {
    const [activeTab, setActiveTab] = useState('draw');
    const [selectedHaircut, setSelectedHaircut] = useState(null);
    const [isRemixing, setIsRemixing] = useState(false);
    const [remixSourceHaircut, setRemixSourceHaircut] = useState(null);
    const [drawingVectors, setDrawingVectors] = useState([]);

    return (
        <div className="container">
            <Header />
            
            <Tabs 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
            />
            
            {activeTab === 'draw' && (
                <DrawingSection 
                    isRemixing={isRemixing}
                    setIsRemixing={setIsRemixing}
                    remixSourceHaircut={remixSourceHaircut}
                    setRemixSourceHaircut={setRemixSourceHaircut}
                    drawingVectors={drawingVectors}
                    setDrawingVectors={setDrawingVectors}
                />
            )}
            
            {activeTab === 'gallery' && (
                <Gallery 
                    setSelectedHaircut={setSelectedHaircut}
                    setActiveTab={setActiveTab}
                    setIsRemixing={setIsRemixing}
                    setRemixSourceHaircut={setRemixSourceHaircut}
                    setDrawingVectors={setDrawingVectors}
                />
            )}
            
            {selectedHaircut && (
                <HaircutModal 
                    haircut={selectedHaircut} 
                    closeModal={() => setSelectedHaircut(null)} 
                    remixHaircut={(haircut) => {
                        handleRemixHaircut(
                            haircut, 
                            setActiveTab, 
                            setSelectedHaircut,
                            setIsRemixing,
                            setRemixSourceHaircut,
                            setDrawingVectors
                        );
                    }}
                />
            )}
        </div>
    );
};

const root = createRoot(document.getElementById('app'));
root.render(<App />);