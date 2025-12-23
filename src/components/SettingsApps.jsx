import React, { useState } from 'react';
import { Search, LogOut, User } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { appsData } from '../data/apps';
import AppCard from './AppCard';

const SettingsApps = ({ session, onNavigate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showUserMenu, setShowUserMenu] = useState(false);

    const lowerSearch = searchTerm.toLowerCase().trim();
    const user = session?.user;
    const displayName = user?.user_metadata?.full_name || user?.user_metadata?.display_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

    // Filter logic
    const filteredSections = appsData.map(section => {
        // If specific category selected, skip others
        if (selectedCategory !== 'all' && section.category !== selectedCategory) return null;

        const filteredItems = section.items.filter(item => {
            const matchSearch =
                item.title.toLowerCase().includes(lowerSearch) ||
                item.subtitle.toLowerCase().includes(lowerSearch) ||
                item.department.toLowerCase().includes(lowerSearch);
            return matchSearch;
        });

        if (filteredItems.length === 0) return null;

        return { ...section, items: filteredItems };
    }).filter(Boolean);

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src="/nhtc.png" alt="Logo" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
                    <h1>Ứng dụng</h1>
                </div>

                {/* User Profile with Dropdown */}
                <div style={{ position: 'relative' }}>
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'background 0.2s' }}
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: '#e0e7ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <User size={22} color="#1d4ed8" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Xin chào,</span>
                            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>{displayName}</span>
                        </div>
                    </div>

                    {/* Dropdown Menu */}
                    {showUserMenu && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '8px',
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                            border: '1px solid #e2e8f0',
                            minWidth: '200px',
                            zIndex: 1000,
                            overflow: 'hidden'
                        }}>
                            <div
                                style={{
                                    padding: '12px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                    borderBottom: '1px solid #f1f5f9'
                                }}
                                onClick={() => {
                                    setShowUserMenu(false);
                                    onNavigate('employees');
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                            >
                                <User size={18} color="#64748b" />
                                <span style={{ fontSize: '0.95rem', color: '#1e293b' }}>Thông tin cá nhân</span>
                            </div>
                            <div
                                style={{
                                    padding: '12px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                                onClick={async () => {
                                    const { error } = await supabase.auth.signOut();
                                    if (error) console.error('Error signing out:', error);
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                            >
                                <LogOut size={18} color="#ef4444" />
                                <span style={{ fontSize: '0.95rem', color: '#ef4444' }}>Đăng xuất</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Search & Filter */}
            <div className="search-container">
                <div className="search-input-wrapper">
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm ứng dụng..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="category-select"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                >
                    <option value="all">Tất cả danh mục</option>
                    {appsData.map(cat => (
                        <option key={cat.category} value={cat.category}>{cat.category}</option>
                    ))}
                </select>
            </div>

            {/* Content Grid */}
            <div className="dashboard-content">
                {filteredSections.map((section, idx) => (
                    <div key={idx} className="section-wrapper">
                        <h2 className="section-header">{section.category}</h2>
                        <div className="apps-grid">
                            {section.items.map(item => (
                                <AppCard key={item.id} item={item} onNavigate={onNavigate} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {filteredSections.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                    Không tìm thấy ứng dụng nào.
                </div>
            )}
        </div>
    );
};

export default SettingsApps;
