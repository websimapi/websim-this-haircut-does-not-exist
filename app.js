import React, { useState } from 'react';
import ReactDOM, { createRoot } from 'react-dom';
import Header from './Header';
import Tabs from './Tabs';
import DrawingSection from './DrawingSection';
import Gallery from './Gallery';
import HaircutModal from './HaircutModal';

// Initialize WebSimSocket connection
const room = new WebsimSocket();

const App = () => {
    const [activeTab, setActiveTab] = useState('draw');
    const [selectedHaircut, setSelectedHaircut] = useState(null);
    const [isRemixing, setIsRemixing] = useState(false);
    const [remixSourceHaircut, setRemixSourceHaircut] = useState(null);
    const [drawingVectors, setDrawingVectors] = useState([]);

    const handleRemixHaircut = (haircut, setActiveTab, setSelectedHaircut, setIsRemixing, setRemixSourceHaircut, setDrawingVectors) => {
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
                
                console.log('Remix setup complete - remixing enabled with source haircut ID:', haircut.id);
            }, 50);
        } catch (error) {
            console.error('Error remixing haircut:', error);
            alert('Sorry, this haircut cannot be remixed. Error: ' + error.message);
        }
    };

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