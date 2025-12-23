import React from 'react';

const EmbedPage = ({ src, title }) => {
    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {title && (
                <div style={{
                    padding: '15px 20px',
                    borderBottom: '1px solid #e2e8f0',
                    background: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#1e293b' }}>{title}</h2>
                </div>
            )}
            <div style={{ flex: 1, position: 'relative' }}>
                <iframe
                    src={src}
                    title={title || "Embedded Content"}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        display: 'block'
                    }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation"
                />
            </div>
        </div>
    );
};

export default EmbedPage;
