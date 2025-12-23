import React from 'react';
import { LayoutDashboard, Clock, Settings, Users, CheckSquare, ClipboardList, Calendar } from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, active, onClick }) => {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: active ? '#eff6ff' : 'transparent', // Light blue for active
            color: active ? '#1d4ed8' : '#64748b', // Blue text for active
            fontWeight: active ? 600 : 500,
            marginBottom: '4px',
            transition: 'all 0.2s',
        }}
            onMouseEnter={(e) => {
                if (!active) {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.color = '#1e293b';
                }
            }}
            onMouseLeave={(e) => {
                if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#64748b';
                }
            }}
            onClick={onClick}
        >
            <Icon size={20} />
            <span>{label}</span>
        </div>
    );
};

const Layout = ({ children, activePage, onNavigate, session }) => {
    // Define Admin/Manager Permissions
    const MANAGER_EMAILS = ['admin@nhtc.com.vn', 'hieu@nhtc.com.vn'];
    const MANAGER_IDS = ['b5565547-b231-4f07-a411-8bea32c132c0', 'e660b4a9-5dc4-4e73-b75e-356ea151ad2d'];

    const userEmail = session?.user?.email;
    const userId = session?.user?.id;
    const isAdmin = MANAGER_EMAILS.includes(userEmail) || MANAGER_IDS.includes(userId);

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            {/* Sidebar */}
            <aside style={{
                width: '260px',
                backgroundColor: '#ffffff',
                borderRight: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                padding: '1.5rem 1rem',
                position: 'sticky',
                top: 0,
                height: '100vh',
                flexShrink: 0
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '2rem',
                    paddingLeft: '0.5rem'
                }}>
                    <img src="/nhtc.png" alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>NHTC Portal</span>
                </div>

                <nav style={{ flex: 1 }}>
                    <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '0.75rem',
                        paddingLeft: '1rem'
                    }}>
                        Menu
                    </div>
                    <SidebarItem
                        icon={Settings}
                        label="Ứng dụng"
                        active={activePage === 'settings'}
                        onClick={() => onNavigate('settings')}
                    />

                    <SidebarItem
                        icon={CheckSquare}
                        label="Daily Task"
                        active={activePage === 'embed'}
                        onClick={() => onNavigate('embed', { src: 'https://script.google.com/macros/s/AKfycbyZZU1E5G8gYUM0QR9PaySblHAOwq_T8ZRsd2MIjzNS2GLiCF57lB4cHh8PPoqNd0yA3Q/exec', title: 'Daily Task' })}
                    />

                    {/* Only show "Quản lý nhân sự" to Admins/Managers */}
                    {isAdmin && (
                        <SidebarItem
                            icon={LayoutDashboard}
                            label="Quản lý nhân sự"
                            active={activePage === 'dashboard'}
                            onClick={() => onNavigate('dashboard')}
                        />
                    )}

                    <SidebarItem
                        icon={Clock}
                        label="Chấm công"
                        active={activePage === 'timekeeping'}
                        onClick={() => onNavigate('timekeeping')}
                    />

                    <SidebarItem
                        icon={Calendar}
                        label="Quản lý phép"
                        active={activePage === 'leave'}
                        onClick={() => onNavigate('leave')}
                    />

                    <SidebarItem
                        icon={ClipboardList}
                        label="Công việc hằng ngày"
                        active={activePage === 'dailywork'}
                        onClick={() => onNavigate('embed', { src: 'https://docs.google.com/spreadsheets/d/1hpjihlRflFrh_8Qn7AziJs3Ey1iseJtPQs6qtRGxxiQ/edit?gid=0', title: 'Công việc hằng ngày' })}
                    />

                </nav>

                <div style={{
                    padding: '1rem',
                    borderTop: '1px solid #e2e8f0',
                    color: '#94a3b8',
                    fontSize: '0.8rem',
                    textAlign: 'center'
                }}>
                    © 2025 NHTC Soft
                </div>
            </aside>

            {/* Main Content */}
            <main style={{ flex: 1, overflowY: 'auto' }}>
                {children}
            </main>
        </div>
    );
};

export default Layout;
