const Tabs = ({ activeTab, setActiveTab }) => {
    return (
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
    );
};

