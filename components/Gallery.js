const { useSyncExternalStore } = React;

const Gallery = ({ 
    setSelectedHaircut, 
    setActiveTab,
    setIsRemixing,
    setRemixSourceHaircut,
    setDrawingVectors
}) => {
    const haircuts = useSyncExternalStore(
        room.collection('haircut').subscribe,
        () => room.collection('haircut').getList().reverse()
    );

    const handleRemix = (haircut) => {
        handleRemixHaircut(
            haircut,
            setActiveTab,
            setSelectedHaircut,
            setIsRemixing,
            setRemixSourceHaircut,
            setDrawingVectors
        );
    };

    return (
        <div className="gallery">
            {haircuts.map(haircut => (
                <div 
                    key={haircut.id} 
                    className="gallery-item"
                >
                    <img 
                        src={haircut.haircutUrl} 
                        alt="Generated haircut" 
                        onClick={() => setSelectedHaircut(haircut)}
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
                                onClick={() => handleRemix(haircut)}
                            >
                                <i className="fas fa-remix"></i> Remix
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

