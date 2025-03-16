const ResultView = ({ description, generatedImageUrl }) => {
    return (
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
    );
};

