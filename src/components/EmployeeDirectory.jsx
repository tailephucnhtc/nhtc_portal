import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Filter, User, XCircle, Briefcase, MapPin, Calendar, Mail, Phone, Edit2, Save, X, LogOut } from 'lucide-react';
import Notification from './Notification';

// Define ModalField OUTSIDE to prevent re-mounting on every render
const ModalField = ({ label, name, value, full, type = "text", options, isEditing, formData, onChange }) => (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '4px' }}>{label}</p>
        {isEditing ? (
            options ? (
                <select
                    name={name}
                    value={formData[name] || ''}
                    onChange={onChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                    <option value="">-- Chọn --</option>
                    {options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            ) : (
                <input
                    type={type}
                    name={name}
                    value={formData[name] || ''}
                    onChange={onChange}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
            )
        ) : (
            <p style={{ color: '#1e293b', fontWeight: 500, fontSize: '1rem', margin: 0 }}>{value || '---'}</p>
        )}
    </div>
);

const EmployeeDirectory = ({ session }) => {
    const user = session?.user;
    const displayName = user?.user_metadata?.full_name || user?.user_metadata?.display_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    // PERMISSION CHECK
    const MANAGER_EMAILS = ['admin@nhtc.com.vn', 'hieu@nhtc.com.vn'];
    const MANAGER_IDS = ['b5565547-b231-4f07-a411-8bea32c132c0', 'e660b4a9-5dc4-4e73-b75e-356ea151ad2d'];

    const isAdmin = MANAGER_EMAILS.includes(session?.user?.email) || MANAGER_IDS.includes(session?.user?.id);

    // Edit Mode States
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        if (session) fetchEmployees();
    }, [session]);

    const fetchEmployees = async () => {
        try {
            const userEmail = session?.user?.email;

            let query = supabase
                .from('employees')
                .select(`
                    *,
                    departments (name),
                    employee_details (*)
                `)
                .order('created_at', { ascending: false });

            // If not admin, restrict to self
            if (!isAdmin && userEmail) {
                query = query.eq('email', userEmail);
            }



            const { data, error } = await query;

            if (error) throw error;

            const formatted = data.map(e => {
                // employee_details is likely an array (1:1 relation usually array in Supabase JS unless single!)
                // Check if it's array or object
                const details = Array.isArray(e.employee_details) ? e.employee_details[0] : e.employee_details;
                return {
                    ...e,
                    ...(details || {}), // Merge details fields (probation_*, contract_*, etc.)
                    id: e.id, // Đảm bảo ID luôn là của employee, không bị details.id ghi đè
                    department_name: e.departments?.name || 'Chưa phân bổ',
                    details_id: details?.id // Keep the detail record ID if needed
                };
            });

            const sortedFormatted = formatted.sort((a, b) => {
                if (a.employee_code === 'NV001') return -1;
                if (b.employee_code === 'NV001') return 1;

                if (a.employee_code === 'NV011') return -1;
                if (b.employee_code === 'NV011') return 1;
                return 0;
            });

            setEmployees(sortedFormatted);
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = () => {
        // Initialize form data with selected employee
        // Ensure null values are empty strings to avoid uncontrolled/controlled warnings
        const initData = { ...selectedEmployee };
        Object.keys(initData).forEach(k => {
            if (initData[k] === null) initData[k] = '';
        });
        setFormData(initData);
        setIsEditing(true);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Prepare update payload (exclude derived/readonly fields)
            const updates = {
                date_of_birth: formData.date_of_birth || null,
                phone_number: formData.phone_number,
                gender: formData.gender,
                marital_status: formData.marital_status,
                children_count: formData.children_count || 0,
                ethnicity: formData.ethnicity,
                religion: formData.religion,
                nationality: formData.nationality,
                education_level: formData.education_level,
                address: formData.address,
                city: formData.city
            };

            const { error } = await supabase
                .from('employees')
                .update(updates)
                .eq('id', selectedEmployee.id);

            if (error) throw error;

            // Update employee_details (Upsert)
            const detailUpdates = {
                employee_id: selectedEmployee.id,
                probation_date: formData.probation_date || null,
                probation_end_date: formData.probation_end_date || null,
                probation_status: formData.probation_status,
                probation_contract_no: formData.probation_contract_no,
                official_contract_date: formData.official_contract_date || null,
                contract_end_date: formData.contract_end_date || null,
                contract_type: formData.contract_type,
                contract_no: formData.contract_no,
                job_status: formData.job_status
            };

            const { error: detailError } = await supabase
                .from('employee_details')
                .upsert(detailUpdates, { onConflict: 'employee_id' });

            if (detailError) throw detailError;

            // Merge updates for local state
            const finalUpdates = { ...updates, ...detailUpdates };

            if (error) throw error;

            // Update local state
            const updatedEmp = { ...selectedEmployee, ...finalUpdates };
            setSelectedEmployee(updatedEmp);
            setEmployees(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e));

            setIsEditing(false);
            setNotification({ message: 'Cập nhật thành công!', type: 'success' });

        } catch (error) {
            console.error('Error updating employee:', error);
            setNotification({ message: 'Lỗi cập nhật: ' + error.message, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleCloseModal = () => {
        if (isEditing) {
            if (window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn đóng không?')) {
                setIsEditing(false);
                setSelectedEmployee(null);
            }
        } else {
            setSelectedEmployee(null);
        }
    };

    const filteredEmployees = employees.filter(e =>
        e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        e.employee_code?.toLowerCase().includes(search.toLowerCase())
    );

    // Group by Department
    const groupedEmployees = filteredEmployees.reduce((acc, emp) => {
        const dept = emp.department_name || 'Khác';
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push(emp);
        return acc;
    }, {});

    const sortedDepts = Object.keys(groupedEmployees).sort((a, b) => {
        if (a === 'Ban Giám đốc') return -1;
        if (b === 'Ban Giám đốc') return 1;
        return a.localeCompare(b);
    });

    return (
        <div style={{ padding: '30px', maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h1 style={{ fontSize: '1.8rem', color: '#1e293b', margin: 0, fontWeight: 700 }}>Thông tin cá nhân</h1>
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

            {/* Sub-Header / Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <p style={{ color: '#64748b', margin: 0 }}>Quản lý thông tin hồ sơ nhân viên</p>
                <div style={{ position: 'relative', width: '300px' }}>
                    <Search size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm nhân viên..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 10px 10px 40px', borderRadius: '8px',
                            border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem'
                        }}
                    />
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Đang tải dữ liệu...</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                    {sortedDepts.map(dept => (
                        <div key={dept}>
                            <h2 style={{ fontSize: '1.4rem', color: '#334155', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', marginBottom: '20px' }}>
                                {dept} <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 400 }}>({groupedEmployees[dept].length})</span>
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                                {groupedEmployees[dept].map(emp => (
                                    <div key={emp.id} style={{
                                        background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden',
                                        transition: 'all 0.2s', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                                    }}>
                                        <div style={{ height: '140px', background: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                                            <div style={{ width: '80px', height: '80px', background: '#cbd5e1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: 'white', fontWeight: 600 }}>
                                                {emp.full_name?.charAt(0)}
                                            </div>
                                        </div>

                                        <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ marginBottom: '15px' }}>
                                                <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: '#1e293b', fontWeight: 700 }}>
                                                    {emp.full_name} <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.9rem' }}>({emp.employee_code})</span>
                                                </h3>
                                                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>{emp.department_name}</p>
                                            </div>

                                            <div style={{ marginBottom: '20px', fontSize: '0.9rem', color: '#334155' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                    <span style={{ color: '#94a3b8' }}>Chức vụ:</span>
                                                    <span style={{ fontWeight: 500 }}>{emp.job_title || 'Nhân viên'}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: '#94a3b8' }}>Loại hình:</span>
                                                    <span style={{ fontWeight: 500 }}>Full Time</span>
                                                </div>
                                            </div>

                                            <div style={{ marginTop: 'auto' }}>
                                                <button
                                                    onClick={() => setSelectedEmployee(emp)}
                                                    style={{
                                                        background: 'transparent', border: 'none', color: '#2563eb',
                                                        fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', padding: 0,
                                                        textDecoration: 'underline', width: '100%', textAlign: 'left'
                                                    }}
                                                >
                                                    Thông tin chi tiết &gt;&gt;
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {sortedDepts.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#cbd5e1' }}>Không tìm thấy nhân viên nào</div>
                    )}
                </div>
            )}

            {/* Employee Detail Modal */}
            {selectedEmployee && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100
                }} onClick={handleCloseModal}>
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
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {isEditing ? (
                                    <>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1',
                                                background: 'white', color: '#64748b', cursor: 'pointer', fontWeight: 500
                                            }}
                                            disabled={saving}
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '8px 16px', borderRadius: '8px', border: 'none',
                                                background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: 500
                                            }}
                                            disabled={saving}
                                        >
                                            <Save size={18} /> {saving ? 'Đang lưu...' : 'Lưu'}
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={handleEditClick}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                            background: '#f8fafc', color: '#334155', cursor: 'pointer', fontWeight: 500
                                        }}
                                    >
                                        <Edit2 size={18} /> Chỉnh sửa
                                    </button>
                                )}
                                <button onClick={handleCloseModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: '10px' }}>
                                    <XCircle size={32} color="#94a3b8" />
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <ModalField label="Ngày sinh" name="date_of_birth" value={selectedEmployee.date_of_birth} type="date" isEditing={isEditing} formData={formData} onChange={handleInputChange} />
                            <ModalField label="Số điện thoại" name="phone_number" value={selectedEmployee.phone_number} isEditing={isEditing} formData={formData} onChange={handleInputChange} />
                            <ModalField label="Email" name="email" value={selectedEmployee.email} full isEditing={isEditing} formData={formData} onChange={handleInputChange} />
                            <ModalField label="Giới tính" name="gender" value={selectedEmployee.gender} options={['Nam', 'Nữ', 'Khác']} isEditing={isEditing} formData={formData} onChange={handleInputChange} />

                            <div style={{ gridColumn: '1 / -1', height: '1px', background: '#f1f5f9', margin: '10px 0' }}></div>

                            <ModalField label="Tình trạng hôn nhân" name="marital_status" value={selectedEmployee.marital_status} options={['Độc thân', 'Đã kết hôn', 'Ly hôn']} isEditing={isEditing} formData={formData} onChange={handleInputChange} />
                            <ModalField label="Số người con" name="children_count" value={selectedEmployee.children_count} type="number" isEditing={isEditing} formData={formData} onChange={handleInputChange} />
                            <ModalField label="Dân tộc" name="ethnicity" value={selectedEmployee.ethnicity} isEditing={isEditing} formData={formData} onChange={handleInputChange} />
                            <ModalField label="Tôn giáo" name="religion" value={selectedEmployee.religion} isEditing={isEditing} formData={formData} onChange={handleInputChange} />
                            <ModalField label="Quốc tịch" name="nationality" value={selectedEmployee.nationality} isEditing={isEditing} formData={formData} onChange={handleInputChange} />
                            <ModalField label="Trình độ học vấn" name="education_level" value={selectedEmployee.education_level} isEditing={isEditing} formData={formData} onChange={handleInputChange} />

                            <div style={{ gridColumn: '1 / -1', height: '1px', background: '#f1f5f9', margin: '10px 0' }}></div>

                            <ModalField label="Địa chỉ" name="address" value={selectedEmployee.address} full isEditing={isEditing} formData={formData} onChange={handleInputChange} />
                            <ModalField label="Thành phố" name="city" value={selectedEmployee.city} isEditing={isEditing} formData={formData} onChange={handleInputChange} />

                            <div style={{ gridColumn: '1 / -1', height: '1px', background: '#f1f5f9', margin: '10px 0' }}></div>
                            <h3 style={{ gridColumn: '1 / -1', fontSize: '1.1rem', color: '#1e293b', marginBottom: '0' }}>Thông tin công việc</h3>

                            <ModalField label="Ngày thử việc" name="probation_date" value={selectedEmployee.probation_date} type="date" isEditing={isEditing} formData={formData} onChange={handleInputChange} />
                            <ModalField label="Ngày kết thúc thử việc" name="probation_end_date" value={selectedEmployee.probation_end_date} type="date" isEditing={isEditing} formData={formData} onChange={handleInputChange} />
                            <ModalField label="Trạng thái thử việc" name="probation_status" value={selectedEmployee.probation_status} options={['Đạt', 'Không đạt', 'Đang thử việc']} isEditing={isEditing} formData={formData} onChange={handleInputChange} />
                            <ModalField label="Số HĐ thử việc" name="probation_contract_no" value={selectedEmployee.probation_contract_no} isEditing={isEditing} formData={formData} onChange={handleInputChange} />

                            <div style={{ gridColumn: '1 / -1', height: '1px', background: '#f1f5f9', margin: '10px 0' }}></div>
                            <h3 style={{ gridColumn: '1 / -1', fontSize: '1.1rem', color: '#1e293b', marginBottom: '0' }}>Hợp đồng chính thức</h3>

                            <ModalField label="Ngày bắt đầu HĐ" name="official_contract_date" value={selectedEmployee.official_contract_date} type="date" isEditing={isEditing} formData={formData} onChange={handleInputChange} />
                            <ModalField label="Ngày kết thúc HĐ" name="contract_end_date" value={selectedEmployee.contract_end_date} type="date" isEditing={isEditing} formData={formData} onChange={handleInputChange} />
                            <ModalField label="Loại hợp đồng" name="contract_type" value={selectedEmployee.contract_type} options={['Hợp đồng xác định thời hạn', 'Hợp đồng không xác định thời hạn']} full isEditing={isEditing} formData={formData} onChange={handleInputChange} />
                            <ModalField label="Số HĐ chính thức" name="contract_no" value={selectedEmployee.contract_no} isEditing={isEditing} formData={formData} onChange={handleInputChange} />

                            <ModalField label="Trạng thái làm việc" name="job_status" value={selectedEmployee.job_status} options={['Đang làm', 'Đã nghỉ việc', 'Nghỉ thai sản']} isEditing={isEditing} formData={formData} onChange={handleInputChange} />
                        </div>
                    </div>
                </div>
            )}

            {notification && (
                <Notification
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                />
            )}
        </div>
    );
};

export default EmployeeDirectory;
