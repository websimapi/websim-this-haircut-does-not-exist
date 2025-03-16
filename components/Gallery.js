import React from 'react';
const { useSyncExternalStore } = React;

const Gallery = ({ openHaircutModal, remixHaircut }) => {
    const room = new WebsimSocket();
    
    const haircuts = useSyncExternalStore(
        room.collection('haircut').subscribe,
        () => room.collection('haircut').getList().reverse()
    );
    
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
    );
};

export default Gallery;