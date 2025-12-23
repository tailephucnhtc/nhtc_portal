import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, Search, Filter, Briefcase, Clock, AlertCircle } from 'lucide-react';

const LeaveManagement = ({ session }) => {
    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState([]);
    const [leaveData, setLeaveData] = useState({}); // { empId: { used: 0, details: [] } }
    const [searchTerm, setSearchTerm] = useState('');
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    const [editingQuota, setEditingQuota] = useState({ empId: null, value: '' });

    useEffect(() => {
        fetchData();
    }, [currentYear]);

    const handleQuotaUpdate = async (empId, newValue) => {
        try {
            // Convert days to hours
            const newQuotaHours = parseFloat(newValue) * 8;

            const { error } = await supabase
                .from('employees')
                .update({ leave_quota: newQuotaHours })
                .eq('id', empId);

            if (error) throw error;

            // Update local state
            setEmployees(prev => prev.map(e =>
                e.id === empId ? { ...e, leave_quota: newQuotaHours } : e
            ));
            setEditingQuota({ empId: null, value: '' });
        } catch (err) {
            console.error("Error updating quota:", err);
            alert("Lỗi cập nhật quota");
        }
    };

    const handleResetAllQuotas = async () => {
        if (!window.confirm("Bạn có chắc chắn muốn RESET toàn bộ phép năm của tất cả nhân viên về 0 không? Hành động này không thể hoàn tác.")) {
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase
                .from('employees')
                .update({ leave_quota: 0 })
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy filter to apply to all

            if (error) throw error;

            alert("Đã reset phép năm của tất cả nhân viên về 0.");
            fetchData(); // Reload data
        } catch (err) {
            console.error("Error resetting quotas:", err);
            alert("Lỗi khi reset phép năm.");
        } finally {
            setLoading(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Employees
            const { data: empData, error: empError } = await supabase
                .from('employees')
                .select('*')
                .order('created_at', { ascending: false });

            if (empError) throw empError;

            // 2. Fetch Attendance for Year to calc Leave
            const startYear = `${currentYear}-01-01`;
            const endYear = `${currentYear}-12-31`;

            const { data: attData, error: attError } = await supabase
                .from('attendance')
                .select('employee_id, date, leave_hours')
                .gte('date', startYear)
                .lte('date', endYear)
                .gt('leave_hours', 0); // Only rows with leave

            if (attError) throw attError;

            // 3. Process Leave Data
            const leaveMap = {}; // empId -> { usedHours: 0, days: [] }

            (attData || []).forEach(record => {
                if (!leaveMap[record.employee_id]) {
                    leaveMap[record.employee_id] = { usedHours: 0, details: [] };
                }
                leaveMap[record.employee_id].usedHours += (record.leave_hours || 0);
                leaveMap[record.employee_id].details.push({
                    date: record.date,
                    hours: record.leave_hours
                });
            });

            setEmployees(empData);
            setLeaveData(leaveMap);

        } catch (error) {
            console.error("Error fetching leave data:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredEmployees = employees.filter(emp =>
        emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ padding: '20px', fontFamily: "'Inter', sans-serif", color: '#1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>Quản lý ngày phép</h1>
                    <p style={{ color: '#64748b', margin: '5px 0 0' }}>Theo dõi hạn mức và lịch sử nghỉ phép năm {currentYear}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handleResetAllQuotas}
                        style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.9rem'
                        }}
                    >
                        <AlertCircle size={18} /> Reset Tất Cả Về 0
                    </button>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="Tìm nhân viên..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '250px', outline: 'none' }}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Đang tải dữ liệu...</div>
            ) : (
                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <tr>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>NHÂN VIÊN</th>
                                <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>QUOTA NĂM (NGÀY)</th>
                                <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>ĐÃ DÙNG (NGÀY)</th>
                                <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>CÒN LẠI (NGÀY)</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>LỊCH SỬ CHI TIẾT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.map(emp => {
                                // 1. Base Quota
                                const baseQuotaHours = emp.leave_quota ?? 0;

                                // 2. Accrual Logic (Same as Timekeeping)
                                const isProbation = ['NV019'].includes(emp.employee_code);
                                let accruedHours = 0;
                                if (currentYear > 2025 && !isProbation) {
                                    // Current logic: 1 day per month up to current month
                                    const month = new Date().getMonth() + 1;
                                    accruedHours = month * 8;
                                }

                                const totalQuotaHours = baseQuotaHours + accruedHours;

                                const usedHours = leaveData[emp.id]?.usedHours || 0;
                                const remainingHours = totalQuotaHours - usedHours;

                                const baseQuotaDays = baseQuotaHours / 8;
                                const accruedDays = accruedHours / 8;
                                const usedDays = usedHours / 8;
                                const remainingDays = remainingHours / 8;

                                const details = leaveData[emp.id]?.details || [];

                                return (
                                    <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ fontWeight: 500 }}>{emp.full_name}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{emp.employee_code}</div>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                {/* Editing Base Quota */}
                                                {editingQuota.empId === emp.id ? (
                                                    <input
                                                        autoFocus
                                                        type="number"
                                                        value={editingQuota.value}
                                                        onChange={e => setEditingQuota({ ...editingQuota, value: e.target.value })}
                                                        onBlur={() => handleQuotaUpdate(emp.id, editingQuota.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleQuotaUpdate(emp.id, editingQuota.value);
                                                            if (e.key === 'Escape') setEditingQuota({ empId: null, value: '' });
                                                        }}
                                                        style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #3b82f6', textAlign: 'center' }}
                                                    />
                                                ) : (
                                                    <span
                                                        onClick={() => setEditingQuota({ empId: emp.id, value: baseQuotaDays.toString() })}
                                                        style={{ background: '#eff6ff', color: '#3b82f6', padding: '4px 10px', borderRadius: '20px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', border: '1px dashed transparent' }}
                                                        onMouseEnter={e => e.currentTarget.style.border = '1px dashed #3b82f6'}
                                                        onMouseLeave={e => e.currentTarget.style.border = '1px dashed transparent'}
                                                        title="Nhấn để sửa Base Quota"
                                                    >
                                                        {baseQuotaDays}
                                                    </span>
                                                )}

                                                {accruedDays > 0 && (
                                                    <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                        +{accruedDays} thâm niên
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <span style={{ color: usedDays > 0 ? '#f97316' : '#94a3b8', fontWeight: 500 }}>
                                                {usedDays}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <span style={{ color: remainingDays < 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                                                {remainingDays}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            {details.length === 0 ? (
                                                <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>Chưa nghỉ phép</span>
                                            ) : (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {details.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).map((d, i) => (
                                                        <span key={i} style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', color: '#475569' }}>
                                                            {new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ({d.hours / 8}d)
                                                        </span>
                                                    ))}
                                                    {details.length > 5 && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>+{details.length - 5}...</span>}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default LeaveManagement;
