import React from 'react';

const Modal = ({ selectedHaircut, closeModal, remixHaircut }) => {
    if (!selectedHaircut) return null;
    
    return (
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
    );
};

export default Modal;