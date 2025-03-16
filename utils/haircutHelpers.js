const handleRemixHaircut = (
    haircut, 
    setActiveTab, 
    setSelectedHaircut, 
    setIsRemixing, 
    setRemixSourceHaircut, 
    setDrawingVectors
) => {
    try {
        console.log('Starting remix of haircut:', haircut.id);
        console.log('Haircut data:', haircut);
        
        // Validate vectors data exists
        if (!haircut.vectors) {
            throw new Error('No vector data available for this haircut');
        }
        
        const vectors = JSON.parse(haircut.vectors || '[]');
        console.log('Parsed vectors data:', vectors);
        
        // Setup remix state
        setDrawingVectors(vectors);
        setIsRemixing(true);
        setRemixSourceHaircut(haircut);
        
        // Close modal and switch to draw tab
        setSelectedHaircut(null);
        
        // Need to wait for tab switch before drawing vectors
        setTimeout(() => {
            setActiveTab('draw');
        }, 50);
        
        console.log('Remix setup complete - remixing enabled with source haircut ID:', haircut.id);
    } catch (error) {
        console.error('Error remixing haircut:', error);
        alert('Sorry, this haircut cannot be remixed. Error: ' + error.message);
    }
};