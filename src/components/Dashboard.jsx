import React, { useState, useEffect } from 'react';
import { Users, UserCheck, UserMinus, MapPin, Briefcase, BarChart3, TrendingUp, Calendar, LogOut, XCircle, Clock } from 'lucide-react';
import { supabase } from '../supabaseClient';
import ChatBot from './ChatBot';
import Notification from './Notification';

const Skeleton = ({ height, width, style }) => (
    <div style={{
        backgroundColor: '#e2e8f0',
        height: height || '100%',
        width: width || '100%',
        borderRadius: '8px',
        animation: 'pulse 1.5s infinite ease-in-out',
        ...style
    }}>
        <style>
            {`
            @keyframes pulse {
                0% { opacity: 0.6; }
                50% { opacity: 0.8; }
                100% { opacity: 0.6; }
            }
            `}
        </style>
    </div>
);

const Dashboard = ({ session }) => {
    const user = session?.user;
    const displayName = user?.user_metadata?.full_name || user?.user_metadata?.display_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, leave: 0, onsite: 0, late: 0 });
    const [employeeList, setEmployeeList] = useState([]);
    const [deptStats, setDeptStats] = useState([]);
    const [demographics, setDemographics] = useState({ avgAge: 0, birthdayMonth: 0, male: 0, female: 0 });
    const [weeklyData, setWeeklyData] = useState([]);
    const [showAllModal, setShowAllModal] = useState(false);
    const [modalFilter, setModalFilter] = useState('all'); // 'all', 'present', 'leave', 'absent'

    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [notification, setNotification] = useState(null);

    // Date Selection State
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const MANAGER_EMAILS = ['admin@nhtc.com.vn', 'hieu@nhtc.com.vn'];
    const MANAGER_IDS = ['b5565547-b231-4f07-a411-8bea32c132c0', 'e660b4a9-5dc4-4e73-b75e-356ea151ad2d'];

    const isAdmin = MANAGER_EMAILS.includes(session?.user?.email) || MANAGER_IDS.includes(session?.user?.id);

    // Access Control check
    if (!isAdmin) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                <h2>Bạn không có quyền truy cập trang này.</h2>
            </div>
        );
    }

    const handleEmployeeClick = (emp) => {
        // Since only Admins/Managers can see this page now, they always have permission.
        setSelectedEmployee(emp);
    };

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Keep loading true for at least 500ms to allow smooth transition if data fetches too fast
                // or just to show the skeleton
                // But generally, actual fetch time is enough. 
                // We'll trust the async flow.
                setLoading(true);

                // 0. Fetch Departments (Manual Join to be safe)
                const { data: deptData } = await supabase.from('departments').select('*');
                const deptMap = (deptData || []).reduce((acc, d) => ({ ...acc, [d.id]: d.name }), {});

                // 1. Fetch Employees (for List + Total Count)
                const { data: employees, error: empError, count } = await supabase
                    .from('employees')
                    .select('*', { count: 'exact' })
                    .order('created_at', { ascending: false });

                if (empError) throw empError;

                // Map departments manually
                const mappedEmployees = (employees || [])
                    .map(e => ({
                        ...e,
                        department_name: deptMap[e.department_id] || deptMap[e.dept_id] || deptMap[e.department] || '---'
                    }))
                    .filter(e => e.department_name !== 'Ban Giám đốc');

                setEmployeeList(mappedEmployees);

                const totalEmp = count || mappedEmployees.length;

                // 2. Fetch Attendance for Selected Date
                const { data: todayAtt, error: attError } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('date', selectedDate);

                if (attError) throw attError;

                // 3. Process Today's Stats & Merge to Employee List
                const attMap = (todayAtt || []).reduce((acc, r) => ({ ...acc, [r.employee_id]: r }), {});

                const processedList = mappedEmployees.map(emp => {
                    const record = attMap[emp.id];
                    let status = 'absent'; // Default
                    if (record) {
                        if ((record.leave_hours || 0) > 0) status = 'leave';
                        else if (record.is_onsite || (record.onsite_mode || 0) > 0) status = 'onsite';
                        else if ((record.standard_hours || 0) > 0 || record.check_in) status = 'present';
                        else status = 'absent';
                    }

                    // Exempt Logic: NV018
                    if (status === 'absent' && emp.employee_code === 'NV018') {
                        status = 'present'; // Treat as present (exempt from timekeeping)
                    }

                    // Check Late Logic (Check-in > 08:05:00)
                    let isLate = false;
                    if (record && record.check_in && record.check_in > '08:05:00') {
                        isLate = true;
                    }

                    return { ...emp, todayStatus: status, isLate, checkInTime: record?.check_in };
                });

                const presentCount = processedList.filter(e => e.todayStatus === 'present').length;
                const onsiteCount = processedList.filter(e => e.todayStatus === 'onsite').length;
                const leaveCount = processedList.filter(e => e.todayStatus === 'leave').length;
                const absentCount = processedList.filter(e => e.todayStatus === 'absent').length;
                const lateCount = processedList.filter(e => e.isLate).length;

                setStats({
                    total: processedList.length,
                    present: presentCount,
                    onsite: onsiteCount,
                    leave: leaveCount,
                    absent: absentCount,
                    late: lateCount
                });

                // Sort: NV001 top, then NV011, then date created desc (original order)
                const sortedList = processedList.sort((a, b) => {
                    if (a.employee_code === 'NV001') return -1;
                    if (b.employee_code === 'NV001') return 1;

                    if (a.employee_code === 'NV011') return -1;
                    if (b.employee_code === 'NV011') return 1;

                    return 0;
                });

                setEmployeeList(sortedList);

                // Calculate Dept Stats
                const dStats = {};

                // Calculate Demographics
                let totalAge = 0;
                let ageCount = 0;
                let birthdayThisMonth = 0;
                let maleCount = 0;
                let femaleCount = 0;
                const currentMonth = new Date().getMonth() + 1;
                const currentYear = new Date().getFullYear();

                processedList.forEach(e => {
                    // Dept
                    const dName = e.department_name || 'Khác';
                    dStats[dName] = (dStats[dName] || 0) + 1;

                    // Gender 
                    const g = e.gender ? e.gender.toLowerCase() : '';
                    if (g === 'nam') maleCount++;
                    else if (g === 'nữ') femaleCount++;

                    // Age & Birthday
                    if (e.date_of_birth) {
                        const parts = e.date_of_birth.split('/');
                        if (parts.length === 3) {
                            const m = parseInt(parts[1], 10);
                            const y = parseInt(parts[2], 10);

                            if (!isNaN(y)) {
                                const age = currentYear - y;
                                totalAge += age;
                                ageCount++;
                            }
                            if (!isNaN(m) && m === currentMonth) {
                                birthdayThisMonth++;
                            }
                        }
                    }
                });

                setDemographics({
                    avgAge: ageCount > 0 ? Math.round(totalAge / ageCount) : 0,
                    birthdayMonth: birthdayThisMonth,
                    male: maleCount,
                    female: femaleCount
                });

                const dStatsArr = Object.entries(dStats)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count);
                setDeptStats(dStatsArr);

                // 4. Fetch Weekly Data (Last 7 Days) for Bar Chart
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(now.getDate() - 6);
                const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];

                const { data: weekAtt, error: weekError } = await supabase
                    .from('attendance')
                    .select('date, standard_hours, leave_hours')
                    .gte('date', sevenDaysStr)
                    .lte('date', todayStr);

                if (weekError) throw weekError;

                // Group by Date to get counts
                const daysMap = {};
                // Init last 7 days keys
                for (let i = 0; i < 7; i++) {
                    const d = new Date();
                    d.setDate(now.getDate() - i);
                    const dStr = d.toISOString().split('T')[0];
                    const dayLabel = d.toLocaleDateString('vi-VN', { weekday: 'short' }); // T2, T3...
                    daysMap[dStr] = { label: dayLabel, present: 0, leave: 0 };
                }

                weekAtt?.forEach(r => {
                    const dStr = r.date;
                    if (daysMap[dStr]) {
                        if ((r.standard_hours || 0) > 0) daysMap[dStr].present += 1;
                        if ((r.leave_hours || 0) > 0) daysMap[dStr].leave += 1;
                    }
                });

                // Convert to array (reversed to show past -> today)
                const chartArr = Object.values(daysMap).reverse();
                setWeeklyData(chartArr);

            } catch (err) {
                console.error("Error fetching dashboard data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [selectedDate]);

    // Helper for CSS Chart Height
    const maxChartVal = weeklyData.length > 0
        ? Math.max(...weeklyData.map(d => Math.max(d.present, d.leave)), 5)
        : 5;

    return (
        <div className="dashboard-container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
            {/* Header with Date Picker */}
            <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Tổng quan nhân sự</h1>
                    <p style={{ color: '#64748b', margin: '5px 0 0' }}>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#64748b' }}>Chọn ngày:</span>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.95rem',
                            outline: 'none',
                            color: '#1e293b',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Xin chào,</span>
                        <span style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>{displayName}</span>
                    </div>
                    <button
                        onClick={() => supabase.auth.signOut()}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
                        title="Đăng xuất"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </div>

            {/* Stats Cards Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                {loading ? (
                    // Skeleton for 5 cards
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} style={{ height: '160px', background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0' }}>
                            <Skeleton height="30px" width="40%" style={{ marginBottom: '10px' }} />
                            <Skeleton height="50px" width="60%" style={{ marginBottom: '20px' }} />
                            <Skeleton height="20px" width="80%" />
                        </div>
                    ))
                ) : (
                    <>
                        {/* Total */}
                        <div
                            onClick={() => { setModalFilter('all'); setShowAllModal(true); }}
                            className="stat-card"
                            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.4)', cursor: 'pointer', transition: 'transform 0.2s', minHeight: '160px' }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700 }}>{stats.total}</h3>
                                    <p style={{ margin: '5px 0 0', opacity: 0.9 }}>Tổng nhân sự</p>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '50%' }}>
                                    <Users size={24} color="white" />
                                </div>
                            </div>
                            <div style={{ marginTop: 'auto', fontSize: '0.85rem', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '20px', width: 'fit-content' }}>
                                Cập nhật hôm nay
                            </div>
                        </div>

                        {/* Present */}
                        <div
                            onClick={() => { setModalFilter('present'); setShowAllModal(true); }}
                            className="stat-card"
                            style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'box-shadow 0.2s', minHeight: '160px' }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <p style={{ margin: '0 0 5px', color: '#64748b', fontSize: '0.9rem' }}>Đang làm việc</p>
                                    <h3 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{stats.present}</h3>
                                </div>
                                <div style={{ background: '#ecfdf5', padding: '10px', borderRadius: '50%', color: '#10b981' }}>
                                    <UserCheck size={24} />
                                </div>
                            </div>
                            <div style={{ marginTop: 'auto', fontSize: '0.85rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <TrendingUp size={14} /> {stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}% Đi làm
                            </div>
                        </div>

                        {/* Onsite */}
                        <div
                            onClick={() => { setModalFilter('onsite'); setShowAllModal(true); }}
                            className="stat-card"
                            style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'box-shadow 0.2s', minHeight: '160px' }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <p style={{ margin: '0 0 5px', color: '#64748b', fontSize: '0.9rem' }}>Onsite</p>
                                    <h3 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{stats.onsite}</h3>
                                </div>
                                <div style={{ background: '#f5f3ff', padding: '10px', borderRadius: '50%', color: '#8b5cf6' }}>
                                    <Briefcase size={24} />
                                </div>
                            </div>
                            <div style={{ marginTop: 'auto', fontSize: '0.85rem', color: '#8b5cf6' }}>
                                Công tác ngoài
                            </div>
                        </div>

                        {/* Absent */}
                        <div
                            onClick={() => { setModalFilter('absent'); setShowAllModal(true); }}
                            className="stat-card"
                            style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'box-shadow 0.2s', minHeight: '160px' }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <p style={{ margin: '0 0 5px', color: '#64748b', fontSize: '0.9rem' }}>Vắng mặt</p>
                                    <h3 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{stats.absent}</h3>
                                </div>
                                <div style={{ background: '#fff1f2', padding: '10px', borderRadius: '50%', color: '#f43f5e' }}>
                                    <UserMinus size={24} />
                                </div>
                            </div>
                            <div style={{ marginTop: 'auto', fontSize: '0.85rem', color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <TrendingUp size={14} style={{ transform: 'rotate(180deg)' }} /> {stats.total > 0 ? Math.round((stats.absent / stats.total) * 100) : 0}% Vắng
                            </div>
                        </div>

                        {/* On Leave Removed */}

                        {/* Late */}
                        <div
                            onClick={() => { setModalFilter('late'); setShowAllModal(true); }}
                            className="stat-card"
                            style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'box-shadow 0.2s', minHeight: '160px' }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <p style={{ margin: '0 0 5px', color: '#64748b', fontSize: '0.9rem' }}>Đi trễ {`>`} 08:05</p>
                                    <h3 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{stats.late}</h3>
                                </div>
                                <div style={{ background: '#fff2e8', padding: '10px', borderRadius: '50%', color: '#ea580c' }}>
                                    <Clock size={24} />
                                </div>
                            </div>
                            <div style={{ marginTop: 'auto', fontSize: '0.85rem', color: '#ea580c' }}>
                                Cần lưu ý
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Demographics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={{ height: '110px', background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
                            <Skeleton height="20px" width="50%" style={{ margin: '0 auto 10px' }} />
                            <Skeleton height="40px" width="30%" style={{ margin: '0 auto' }} />
                        </div>
                    ))
                ) : (
                    <>
                        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <p style={{ margin: '0 0 5px', color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>Tuổi trung bình</p>
                            <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#1e293b' }}>{demographics.avgAge}</h3>
                        </div>
                        <div
                            onClick={() => { setModalFilter('birthday'); setShowAllModal(true); }}
                            style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                        >
                            <p style={{ margin: '0 0 5px', color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>Sinh nhật tháng {new Date().getMonth() + 1}</p>
                            <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#1e293b' }}>{demographics.birthdayMonth}</h3>
                        </div>
                        <div
                            onClick={() => { setModalFilter('female'); setShowAllModal(true); }}
                            style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                        >
                            <p style={{ margin: '0 0 5px', color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>Nhân viên Nữ</p>
                            <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#ec4899' }}>{demographics.female}</h3>
                        </div>
                        <div
                            onClick={() => { setModalFilter('male'); setShowAllModal(true); }}
                            style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                        >
                            <p style={{ margin: '0 0 5px', color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>Nhân viên Nam</p>
                            <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#3b82f6' }}>{demographics.male}</h3>
                        </div>
                    </>
                )}
            </div>

            {/* Charts Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                {loading ? (
                    <>
                        {/* Skeleton for 2 Charts */}
                        <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', height: '300px' }}>
                            <Skeleton height="30px" width="50%" style={{ marginBottom: '20px' }} />
                            <Skeleton height="200px" />
                        </div>
                        <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', height: '300px' }}>
                            <Skeleton height="30px" width="50%" style={{ marginBottom: '20px' }} />
                            <Skeleton height="200px" />
                        </div>
                    </>
                ) : (
                    <>
                        {/* Daily Attendance Stats (Bar Chart) */}
                        <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', minHeight: '300px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>Thống kê chấm công (7 ngày)</h3>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748b' }}>
                                        <span style={{ width: 8, height: 8, background: '#3b82f6', borderRadius: '50%' }}></span> Đi làm
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748b' }}>
                                        <span style={{ width: 8, height: 8, background: '#f97316', borderRadius: '50%' }}></span> Nghỉ phép
                                    </div>
                                </div>
                            </div>
                            <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px' }}>
                                {weeklyData.map((d, i) => (
                                    <div
                                        key={i}
                                        title={`${d.label}: ${d.present} Đi làm - ${d.leave} Nghỉ phép`}
                                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end', cursor: 'pointer' }}
                                    >
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '100%', paddingBottom: '5px' }}>
                                            {/* Present */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', width: '14px' }}>
                                                <span style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 600, marginBottom: '2px', opacity: d.present > 0 ? 1 : 0 }}>{d.present}</span>
                                                <div style={{
                                                    width: '100%',
                                                    background: '#3b82f6',
                                                    borderRadius: '4px 4px 0 0',
                                                    height: `${Math.max((d.present / maxChartVal) * 100, 4)}%`,
                                                    transition: 'height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                                    opacity: d.present > 0 ? 1 : 0.2
                                                }}>
                                                </div>
                                            </div>
                                            {/* Leave */}
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', width: '14px' }}>
                                                {d.leave > 0 && (
                                                    <span style={{ fontSize: '0.7rem', color: '#f97316', fontWeight: 600, marginBottom: '2px' }}>{d.leave}</span>
                                                )}
                                                <div style={{
                                                    width: '100%',
                                                    background: '#f97316',
                                                    borderRadius: '4px 4px 0 0',
                                                    height: `${Math.max((d.leave / maxChartVal) * 100, 4)}%`,
                                                    minHeight: d.leave > 0 ? '4px' : '0',
                                                    opacity: d.leave > 0 ? 1 : 0.2, // Make it subtle if 0
                                                    transition: 'height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                                }}>
                                                </div>
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{d.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Department Stats */}
                        <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
                            <h3 style={{ margin: '0 0 20px', fontSize: '1.1rem', color: '#1e293b' }}>Nhân sự theo phòng ban</h3>
                            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '200px' }}>
                                {deptStats.map((dept, idx) => (
                                    <div key={idx} style={{ marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                                            <span style={{ color: '#334155', fontWeight: 500 }}>{dept.name}</span>
                                            <span style={{ color: '#64748b' }}>{dept.count}</span>
                                        </div>
                                        <div style={{ width: '100%', background: '#f1f5f9', borderRadius: '4px', height: '8px' }}>
                                            <div style={{
                                                width: `${(dept.count / Math.max(...deptStats.map(d => d.count), 1)) * 100}%`,
                                                background: '#3b82f6',
                                                height: '100%',
                                                borderRadius: '4px',
                                                transition: 'width 0.8s ease'
                                            }}></div>
                                        </div>
                                    </div>
                                ))}
                                {deptStats.length === 0 && <p style={{ color: '#94a3b8', textAlign: 'center' }}>Chưa có dữ liệu phòng ban</p>}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Employee List Table */}
            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>Danh sách nhân viên</h3>
                    <button
                        onClick={() => { setModalFilter('all'); setShowAllModal(true); }}
                        style={{ background: '#eff6ff', color: '#3b82f6', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}
                    >
                        Xem tất cả
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    {loading ? (
                        // Table Skeleton
                        <div>
                            <Skeleton height="40px" style={{ marginBottom: '10px' }} />
                            <Skeleton height="40px" style={{ marginBottom: '10px' }} />
                            <Skeleton height="40px" style={{ marginBottom: '10px' }} />
                            <Skeleton height="40px" style={{ marginBottom: '10px' }} />
                            <Skeleton height="40px" style={{ marginBottom: '10px' }} />
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>
                                    <th style={{ padding: '12px 0', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>Tên nhân viên</th>
                                    <th style={{ padding: '12px 0', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>Mã NV</th>
                                    <th style={{ padding: '12px 0', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>Phòng ban</th>
                                    <th style={{ padding: '12px 0', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>Vị trí</th>
                                    <th style={{ padding: '12px 0', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employeeList.slice(0, 10).map((emp) => (
                                    <tr
                                        key={emp.id}
                                        onClick={() => handleEmployeeClick(emp)}
                                        style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer', transition: 'background 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '12px 0', color: '#334155', fontWeight: 500 }}>{emp.full_name}</td>
                                        <td style={{ padding: '12px 0', color: '#64748b', fontSize: '0.9rem' }}>{emp.employee_code}</td>
                                        <td style={{ padding: '12px 0', color: '#64748b' }}>{emp.department_name}</td>
                                        <td style={{ padding: '12px 0', color: '#64748b', fontStyle: 'italic' }}>{emp.job_title || '-'}</td>
                                        <td style={{ padding: '12px 0' }}>
                                            {emp.todayStatus === 'present' && <span style={{ background: '#ecfdf5', color: '#10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>Active</span>}
                                            {emp.todayStatus !== 'present' && <span style={{ background: '#f1f5f9', color: '#94a3b8', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>Offline</span>}
                                        </td>
                                    </tr>
                                ))}
                                {employeeList.length === 0 && (
                                    <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Chưa có nhân viên</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal See All / Filtered - Removed redundant logic for brevity, keeping same */}
            {showAllModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }} onClick={() => setShowAllModal(false)}>
                    <div style={{
                        background: 'white', width: '90%', maxWidth: '1000px', maxHeight: '90vh',
                        overflowY: 'auto', borderRadius: '16px', padding: '30px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                                    {modalFilter === 'all' && 'Tất cả nhân viên'}
                                    {modalFilter === 'present' && 'Nhân viên Đang làm việc'}
                                    {modalFilter === 'onsite' && 'Nhân viên Onsite'}
                                    {modalFilter === 'absent' && 'Nhân viên Vắng mặt'}
                                    {modalFilter === 'late' && 'Nhân viên Đi trễ'}
                                    {modalFilter === 'birthday' && `Sinh nhật tháng ${new Date().getMonth() + 1}`}
                                    {modalFilter === 'female' && 'Nhân viên Nữ'}
                                    {modalFilter === 'male' && 'Nhân viên Nam'}
                                </h2>
                                <p style={{ color: '#64748b', margin: '5px 0 0' }}>
                                    Danh sách {modalFilter === 'all' ? '' : 'lọc theo điều kiện'} • {employeeList.filter(e => {
                                        if (modalFilter === 'all') return true;
                                        if (['present', 'absent', 'onsite'].includes(modalFilter)) return e.todayStatus === modalFilter;
                                        if (modalFilter === 'late') return e.isLate;
                                        if (modalFilter === 'female') return (e.gender || '').toLowerCase() === 'nữ';
                                        if (modalFilter === 'male') return (e.gender || '').toLowerCase() === 'nam';
                                        if (modalFilter === 'birthday') return e.date_of_birth?.includes(`/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/`) || e.date_of_birth?.split('/')[1] == (new Date().getMonth() + 1);
                                        return true;
                                    }).length} nhân viên
                                </p>
                            </div>
                            <button onClick={() => setShowAllModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                <XCircle size={28} color="#64748b" />
                            </button>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                                        <th style={{ padding: '12px', color: '#64748b', fontWeight: 600 }}>Tên nhân viên</th>
                                        <th style={{ padding: '12px', color: '#64748b', fontWeight: 600 }}>Mã NV</th>
                                        <th style={{ padding: '12px', color: '#64748b', fontWeight: 600 }}>Email</th>
                                        <th style={{ padding: '12px', color: '#64748b', fontWeight: 600 }}>Phòng ban</th>
                                        <th style={{ padding: '12px', color: '#64748b', fontWeight: 600 }}>Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employeeList
                                        .filter(e => {
                                            if (modalFilter === 'all') return true;
                                            if (['present', 'absent', 'onsite'].includes(modalFilter)) return e.todayStatus === modalFilter;
                                            if (modalFilter === 'late') return e.isLate;
                                            if (modalFilter === 'female') return (e.gender || '').toLowerCase() === 'nữ';
                                            if (modalFilter === 'male') return (e.gender || '').toLowerCase() === 'nam';
                                            if (modalFilter === 'birthday') {
                                                const parts = e.date_of_birth?.split('/');
                                                return parts?.length === 3 && parseInt(parts[1], 10) === (new Date().getMonth() + 1);
                                            }
                                            return true;
                                        })
                                        .map((emp) => (
                                            <tr key={emp.id} onClick={() => handleEmployeeClick(emp)} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                                                <td style={{ padding: '12px', fontWeight: 500, color: '#1e293b' }}>{emp.full_name}</td>
                                                <td style={{ padding: '12px', color: '#64748b' }}>{emp.employee_code}</td>
                                                <td style={{ padding: '12px', color: '#64748b' }}>{emp.email}</td>
                                                <td style={{ padding: '12px', color: '#64748b' }}>{emp.department_name}</td>
                                                <td style={{ padding: '12px' }}>
                                                    {emp.todayStatus === 'present' && <span style={{ background: '#ecfdf5', color: '#10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>Đi làm</span>}
                                                    {emp.todayStatus === 'leave' && <span style={{ background: '#fff7ed', color: '#f97316', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>Nghỉ phép</span>}
                                                    {emp.todayStatus === 'absent' && <span style={{ background: '#fff1f2', color: '#f43f5e', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>Vắng mặt</span>}
                                                    {emp.todayStatus === 'onsite' && <span style={{ background: '#f5f3ff', color: '#8b5cf6', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>Onsite</span>}
                                                    {modalFilter === 'late' && emp.checkInTime && <span style={{ marginLeft: '8px', color: '#ea580c', fontSize: '0.75rem', fontWeight: 600 }}>({emp.checkInTime.substring(0, 5)})</span>}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div >
            )}

            {
                selectedEmployee && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100
                    }} onClick={() => setSelectedEmployee(null)}>
                        <div style={{
                            background: 'white', width: '90%', maxWidth: '700px', maxHeight: '90vh',
                            overflowY: 'auto', borderRadius: '16px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                    <div style={{ width: '80px', height: '80px', background: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#64748b', fontWeight: 600 }}>
                                        {selectedEmployee.full_name?.charAt(0)}
                                    </div>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>{selectedEmployee.full_name}</h2>
                                        <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '0.95rem' }}>
                                            {selectedEmployee.job_title} • {selectedEmployee.department_name}
                                        </p>
                                        <span style={{ display: 'inline-block', marginTop: '8px', background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>
                                            {selectedEmployee.employee_code}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedEmployee(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                    <XCircle size={32} color="#94a3b8" />
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <DetailItem label="Ngày sinh" value={selectedEmployee.date_of_birth} />
                                <DetailItem label="Số điện thoại" value={selectedEmployee.phone_number} />
                                <DetailItem label="Email" value={selectedEmployee.email} />
                                <DetailItem label="Giới tính" value={selectedEmployee.gender} />
                                <div style={{ gridColumn: '1 / -1', height: '1px', background: '#f1f5f9', margin: '10px 0' }}></div>
                                <DetailItem label="Tình trạng hôn nhân" value={selectedEmployee.marital_status} />
                                <DetailItem label="Số người con" value={selectedEmployee.children_count} />
                                <DetailItem label="Dân tộc" value={selectedEmployee.ethnicity} />
                                <DetailItem label="Tôn giáo" value={selectedEmployee.religion} />
                                <DetailItem label="Quốc tịch" value={selectedEmployee.nationality} />
                                <DetailItem label="Trình độ học vấn" value={selectedEmployee.education_level} />
                                <div style={{ gridColumn: '1 / -1', height: '1px', background: '#f1f5f9', margin: '10px 0' }}></div>
                                <DetailItem label="Địa chỉ" value={selectedEmployee.address} full />
                                <DetailItem label="Thành phố" value={selectedEmployee.city} />
                            </div>
                        </div>
                    </div>
                )
            }

            {notification && (
                <Notification
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                />
            )}

            <ChatBot />
        </div >
    );
};

// Helper Component for Detail stats
const DetailItem = ({ label, value, full }) => (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
        <p style={{ margin: '0 0 4px', fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
        <p style={{ margin: 0, fontSize: '1rem', color: '#334155', fontWeight: 500 }}>{value || '---'}</p>
    </div>
);

export default Dashboard;
