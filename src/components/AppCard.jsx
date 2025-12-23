import React from 'react';
import * as Icons from 'lucide-react';

const AppCard = ({ item, onNavigate }) => {
    const IconComponent = Icons[item.icon] || Icons.Box;

    // Map color names to CSS classes/vars or hex values
    const getColor = (color) => {
        switch (color) {
            case 'red': return '#ef4444';
            case 'purple': return '#a855f7';
            case 'blue': return '#3b82f6';
            case 'orange': return '#f97316';
            case 'green': return '#22c55e';
            case 'pink': return '#ec4899';
            case 'gray': return '#64748b';
            case 'light-blue': return '#06b6d4';
            default: return '#3b82f6';
        }
    };

    const themeColor = getColor(item.color);

    const handleClick = (e) => {
        // For items marked as embed, navigate to embed page (iframe)
        if (item.embed === true && onNavigate) {
            e.preventDefault();
            onNavigate('embed', { src: item.url, title: item.title });
        }
        // Otherwise, default <a> tag behavior (open in new tab)
    };

    return (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="app-card"
            style={{ '--theme-color': themeColor }}
            onClick={handleClick}
        >
            <div className="icon-wrapper" style={{ backgroundColor: item.icon.startsWith('/') ? 'transparent' : themeColor }}>
                {item.icon.startsWith('/') ? (
                    <img
                        src={item.icon}
                        alt={item.title}
                        style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                    />
                ) : (
                    <IconComponent size={24} color="white" />
                )}
            </div>
            <div className="content">
                <h3 className="title">{item.title}</h3>
                <p className="subtitle">{item.subtitle}</p>
                <div className="department-tag">{item.department}</div>
            </div>
        </a>
    );
};

export default AppCard;
