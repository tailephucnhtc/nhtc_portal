import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Filter, Download, Search, X, FileText, CheckCircle, AlertCircle, Info, LogOut } from 'lucide-react';
import { supabase } from '../supabaseClient';
import emailjs from '@emailjs/browser';

const Timekeeping = ({ session }) => {
    const user = session?.user;
    const displayName = user?.user_metadata?.full_name || user?.user_metadata?.display_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [activeCell, setActiveCell] = useState(null); // { empId, day, rect, currentData }
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showPayroll, setShowPayroll] = useState(false); // New State
    const [payrollData, setPayrollData] = useState({}); // { empId: { basic: 0, allowance: 0 } }
    const [isSendingAll, setIsSendingAll] = useState(false);

    // Notification State
    const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' | 'info' }

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        // Auto hide after 3 seconds, unless it's a long error/summary
        const duration = type === 'error' ? 5000 : 3000;
        setTimeout(() => setToast(null), duration);
    };

    const [currentWeek, setCurrentWeek] = useState(1);
    const [employeeData, setEmployeeData] = useState([]);
    const [showCalendar, setShowCalendar] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    useEffect(() => {
        setCurrentWeek(1); // Reset to week 1 when month changes
        if (session) fetchData();
    }, [currentMonth, currentYear, session]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Employees with Permission Logic
            const userEmail = session?.user?.email;
            const userId = session?.user?.id;

            const MANAGER_EMAILS = ['admin@nhtc.com.vn', 'hieu@nhtc.com.vn'];
            const MANAGER_IDS = ['b5565547-b231-4f07-a411-8bea32c132c0', 'e660b4a9-5dc4-4e73-b75e-356ea151ad2d'];

            const isAdmin = MANAGER_EMAILS.includes(userEmail) || MANAGER_IDS.includes(userId);

            let empQuery = supabase
                .from('employees')
                .select(`
id,
    full_name,
    employee_code,
    email,
    leave_quota,
    departments(name)
        `);

            // If not admin and user has email, restrict to self
            if (!isAdmin && userEmail) {
                // Check if user exists in employees table
                const { data: selfCheck } = await supabase
                    .from('employees')
                    .select('id')
                    .eq('email', userEmail);

                if (selfCheck && selfCheck.length > 0) {
                    empQuery = empQuery.eq('email', userEmail);
                }
            }

            const { data: employees, error: empError } = await empQuery;

            if (empError) throw empError;

            // 2. Fetch Attendance for the WHOLE YEAR (for YTD Leave Calc)
            const yearStart = String(currentYear) + "-01-01";
            const yearEnd = String(currentYear) + "-12-31";

            const { data: yearAttendance, error: attError } = await supabase
                .from('attendance')
                .select('*')
                .gte('date', yearStart)
                .lte('date', yearEnd);

            if (attError) throw attError;

            // 3. Merge Data
            const mergedData = employees.map(emp => {
                const empAttendance = {};
                let usedLeaveYTD = 0;

                yearAttendance.forEach(record => {
                    // Only process this employee
                    if (record.employee_id === emp.id) {
                        const recDate = new Date(record.date);
                        const recMonth = recDate.getMonth() + 1;
                        const recDay = recDate.getDate();

                        // Accumulate Used Leave for YTD (Year To Date)
                        // Should we count future leave? Usually yes, "Remaining" reflects booked leave.
                        if (record.leave_hours) {
                            usedLeaveYTD += record.leave_hours;
                        }

                        // Populate Grid Data ONLY for Current Month
                        if (recMonth === currentMonth) {
                            empAttendance[recDay] = {
                                standard: record.standard_hours,
                                ot: record.ot_hours,
                                ot_weekend: record.ot_weekend || 0,
                                leave: record.leave_hours || 0,
                                onsite_mode: record.onsite_mode || 0,
                                onsite_place: record.onsite_place || 0,
                                is_onsite: record.onsite_mode > 0,
                                check_in: record.check_in,
                                check_out: record.check_out
                            };
                        }
                    }
                });

                // Accrual Logic: 
                // Base Quota (from DB) + 1 Day (8h) per month passed in current year.
                // "Sau t12/2025": If year > 2025, we add accrual.
                // Example: Jan (Month 1): Base + 1*8.
                let accrued = 0;
                // Exclude Probation Employees (NV019)
                const isProbation = ['NV019'].includes(emp.employee_code);

                if (currentYear > 2025 && !isProbation) {
                    // Add 1 day (8h) for each month up to current
                    accrued = currentMonth * 8;
                }

                // Effective Remaining = (Base + Accrued) - Used
                const baseQuota = emp.leave_quota || 0;
                const totalQuota = baseQuota + accrued;
                const remaining = totalQuota - usedLeaveYTD;

                // Apply DISPLAY logic transformation
                const processedAttendance = {};
                for (const [day, val] of Object.entries(empAttendance)) {
                    let displayVal = { ...val };

                    // Logic: Day limit 8h. OT is anything after 17:00 (which implies > 8h standard calc usually, but let's stick to the rule)
                    // "Weekdays: Max 8h standard. Check-out > 18:00 display 8 + (hours after 17:00)"
                    // "Weekend: Total hours shown directly?" - User said "ngày nghỉ thì không hiện luôn tổng số tiếng" -> maybe "Shows total hours"? Or "Not show split"?
                    // Re-reading: "Hien toan bo tong so tieng" (Show total hours) likely for weekends based on context "OT chi tinh cho ngay thuong"

                    if (val.standard > 8) {
                        displayVal.standard = 8;
                        displayVal.ot = parseFloat((val.standard - 8).toFixed(2)); // Store excess as OT for display or internal
                        // But wait, the user wants "8 + X" format specifically for Weekdays if > 18h?
                    }
                    processedAttendance[day] = displayVal;
                }

                return {
                    id: emp.id,
                    name: emp.full_name,
                    email: emp.email,
                    dept: emp.departments?.name || 'N/A',
                    code: emp.employee_code,
                    leave_quota: emp.leave_quota || 96,
                    remaining_leave: remaining,
                    data: empAttendance // Use raw data, we will format in render
                };
            });

            // Filter out Ban Giám đốc and NV018
            const filteredData = mergedData.filter(emp =>
                emp.code !== 'NV018' && emp.dept !== 'Ban Giám đốc'
            );

            // Custom Sort Order
            const customOrder = [
                'Phan Thanh Toàn',
                'Vũ Thanh Bình',
                'Ngô Đức Thế',
                'Phan Thanh Bình',
                'Phạm Đức Hiền',
                'Đinh Quang Huy',
                'Lê Phúc Tài',
                'Lê Anh Trí Tri',
                'Lý Hữu Đang',
                'Bùi Hoàng Tùng',
                'Nguyễn Đức Thắng',
                'Võ Thị Kim Xuân',
                'Mai Thị Kim Thúy',
                'Lê Dư Tuyết Nhi',
                'Nguyễn Thị Yến Loan',
                'Tiêu Ân Tuấn'
            ];

            filteredData.sort((a, b) => {
                const indexA = customOrder.indexOf(a.name);
                const indexB = customOrder.indexOf(b.name);

                // If both are in the list, sort by index
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                // If A is in list but B is not, A comes first
                if (indexA !== -1) return -1;
                // If B is in list but A is not, B comes first
                if (indexB !== -1) return 1;
                // If neither, sort by code (fallback)
                return a.code.localeCompare(b.code);
            });

            setEmployeeData(filteredData);

        } catch (error) {
            console.error("Error fetching timekeeping data:", error);
            showToast("Lỗi tải dữ liệu chấm công: " + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const daysInMonth = useMemo(() => new Date(currentYear, currentMonth, 0).getDate(), [currentYear, currentMonth]);

    // Keep this for Monthly Totals Calculation
    const fullMonthDays = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

    // Week Logic
    const weeks = useMemo(() => {
        const w = [];
        let currentWeekDays = [];

        for (let day = 1; day <= daysInMonth; day++) {
            currentWeekDays.push(day);
            const date = new Date(currentYear, currentMonth - 1, day);
            // If Sunday (0) or Last Day of Month, end the week
            if (date.getDay() === 0 || day === daysInMonth) {
                w.push(currentWeekDays);
                currentWeekDays = [];
            }
        }
        return w;
    }, [daysInMonth, currentYear, currentMonth]);

    const visibleDays = weeks[currentWeek - 1] || [];

    const getDayOfWeek = (day, month, year) => {
        const date = new Date(year, month - 1, day);
        const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        return days[date.getDay()];
    };

    const isWeekend = (day, month, year) => {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay();

        // Holidays
        if (day === 1 && month === 1 && year === 2026) return true; // New Year 2026

        // Sunday is always off
        if (dayOfWeek === 0) return true;

        // Alternating Saturday (13/12/2025 is Work)
        if (dayOfWeek === 6) {
            const anchor = new Date(2025, 11, 13); // Dec 13, 2025 (Month 0-indexed)
            const msPerWeek = 1000 * 60 * 60 * 24 * 7;
            const diffTime = date.getTime() - anchor.getTime();
            const diffWeeks = Math.round(diffTime / msPerWeek);

            // Even diff = Same as Anchor (Work) = False
            // Odd diff = Opposite (Off) = True
            return Math.abs(diffWeeks) % 2 === 1;
        }

        return false;
    };

    const [selectedCells, setSelectedCells] = useState([]); // Array of keys "empId-day"

    // ... (existing helper functions)

    const handleCellClick = (e, emp, day) => {
        // PERMISSION CHECK
        const ALLOWED_ADMIN_ID = 'e660b4a9-5dc4-4e73-b75e-356ea151ad2d'; // Admin ID provided
        const canEdit = session?.user?.id === ALLOWED_ADMIN_ID;

        if (!canEdit) return; // Read-only for others

        // Multi-selection Logic (Ctrl/Meta Key)
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault(); // Prevent text selection etc
            const key = `${emp.id}-${day}`;
            setSelectedCells(prev => {
                if (prev.includes(key)) return prev.filter(k => k !== key);
                return [...prev, key];
            });
            setActiveCell(null); // Close single edit if open
            return;
        }

        // Single Click - Clear multi-selection unless we are in a special mode (but here standard behavior)
        if (selectedCells.length > 0) {
            setSelectedCells([]);
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const currentVal = emp.data[day];
        const isDayOff = isWeekend(day, currentMonth, currentYear);

        // Normalize data to object structure
        let dataObj = { standard: 8, ot: 0, ot_weekend: 0, leave: 0, onsite_mode: 0, onsite_place: 0, check_in: null, check_out: null }; // Default logic

        if (typeof currentVal === 'number') {
            if (isDayOff) {
                dataObj = { standard: 0, ot: 0, ot_weekend: currentVal, leave: 0, onsite_mode: 0, onsite_place: 0, check_in: null, check_out: null };
            } else {
                dataObj = { standard: currentVal, ot: 0, ot_weekend: 0, leave: 0, onsite_mode: 0, onsite_place: 0, check_in: null, check_out: null };
            }
        } else if (typeof currentVal === 'object' && currentVal !== null) {
            dataObj = { ...dataObj, ...currentVal };
        } else {
            if (isDayOff) {
                dataObj = { standard: 0, ot: 0, ot_weekend: 0, leave: 0, onsite_mode: 0, onsite_place: 0, check_in: null, check_out: null };
            } else {
                dataObj = { standard: 8, ot: 0, ot_weekend: 0, leave: 0, onsite_mode: 0, onsite_place: 0, check_in: null, check_out: null };
            }
        }
        dataObj.is_onsite = dataObj.onsite_mode > 0;

        setActiveCell({
            empId: emp.id,
            day,
            rect,
            data: dataObj,
            isBulk: false
        });
    };

    const handleBulkEdit = () => {
        if (selectedCells.length === 0) return;

        // Open Popover in Center Screen with Default Data
        setActiveCell({
            empId: 'BULK',
            day: 'Nhiều ngày',
            rect: {
                top: window.innerHeight / 2 - 200,
                left: window.innerWidth / 2 - 130,
                bottom: window.innerHeight / 2 + 200,
                right: window.innerWidth / 2 + 130
                // Pseudo/Centered Rect
            },
            data: { standard: 8, ot: 0, ot_weekend: 0, leave: 0, onsite_mode: 0 },
            isBulk: true
        });
    };

    const handleBulkSave = async (newData) => {
        const updates = [];
        const monthStr = String(currentMonth).padStart(2, '0');

        // 1. Calculate updates and prepare new state synchronously
        setEmployeeData(prev => {
            return prev.map(emp => {
                const empUpdates = {};
                let hasUpdate = false;

                // Find days for this employee in selectedCells
                // NOTE: We iterate selectedCells here. 
                // To avoid side-effects in state setter, we should probably calculate 'updates' outside.
                // But for now, let's just make sure we capture the data correctly.
                // BETTER APPROACH: Iterate selectedCells to build 'updates' payload FIRST.
                // Then use that to update state.

                return emp;
            });
        });

        // RE-IMPLEMENTATION:
        // 1. Build DB Payload & Identify Local Updates
        const localUpdatesByEmpId = {}; // { empId: { day: data } }

        selectedCells.forEach(key => {
            const parts = key.split('-');
            const dStr = parts.pop();
            const eId = parts.join('-');
            const day = Number(dStr);

            // Prepare DB Payload
            const dayStr = String(day).padStart(2, '0');
            const fullDate = `${currentYear}-${monthStr}-${dayStr}`;

            updates.push({
                employee_id: eId,
                date: fullDate,
                standard_hours: newData.standard,
                ot_hours: newData.ot,
                ot_weekend: newData.ot_weekend,
                leave_hours: newData.leave,
                is_onsite: newData.onsite_mode > 0,
                onsite_mode: newData.onsite_mode,
                onsite_place: newData.onsite_place
            });

            if (!localUpdatesByEmpId[eId]) {
                localUpdatesByEmpId[eId] = {};
            }
            localUpdatesByEmpId[eId][day] = newData;
        });

        // 2. Optimistic Update State
        setEmployeeData(prev => {
            return prev.map(emp => {
                if (localUpdatesByEmpId[emp.id]) {
                    return {
                        ...emp,
                        data: { ...emp.data, ...localUpdatesByEmpId[emp.id] }
                    };
                }
                return emp;
            });
        });

        // 3. Database Update (Bulk Upsert)
        try {
            const { error } = await supabase
                .from('attendance')
                .upsert(updates, { onConflict: 'employee_id, date' });

            if (error) throw error;
            console.log("Bulk saved successfully");

        } catch (error) {
            console.error("Error bulk saving:", error);
            showToast("Lỗi lưu hàng loạt: " + error.message, 'error');
        }

        setSelectedCells([]);
        setActiveCell(null);
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Bạn có chắc muốn xóa dữ liệu của ${selectedCells.length} ô đã chọn ? `)) return;

        const monthStr = String(currentMonth).padStart(2, '0');
        const localDeletesByEmpId = {}; // { empId: [day1, day2] }
        const deletePromises = [];

        // 1. Prepare Data
        selectedCells.forEach(key => {
            const parts = key.split('-');
            const dStr = parts.pop();
            const eId = parts.join('-');
            const day = Number(dStr);

            // Group for local update
            if (!localDeletesByEmpId[eId]) {
                localDeletesByEmpId[eId] = [];
            }
            localDeletesByEmpId[eId].push(day);

            // Prepare DB Delete Promise
            const dayStr = String(day).padStart(2, '0');
            const fullDate = `${currentYear}-${monthStr}-${dayStr}`;

            deletePromises.push(
                supabase
                    .from('attendance')
                    .delete()
                    .match({ employee_id: eId, date: fullDate })
            );
        });

        // 2. Optimistic Update
        setEmployeeData(prev => {
            return prev.map(emp => {
                if (localDeletesByEmpId[emp.id]) {
                    const updatedData = { ...emp.data };
                    localDeletesByEmpId[emp.id].forEach(d => {
                        delete updatedData[d];
                    });
                    return { ...emp, data: updatedData };
                }
                return emp;
            });
        });

        // 3. Database Delete
        try {
            await Promise.all(deletePromises);
            console.log("Bulk deleted successfully");
        } catch (error) {
            console.error("Error bulk deleting:", error);
            showToast("Lỗi xóa hàng loạt: " + error.message, 'error');
        }

        setSelectedCells([]);
        setActiveCell(null);
    };

    const calculatePayrollStats = (emp) => {
        let totalStandard = 0;
        let totalConvertedOT = 0;
        let totalLeaveHours = 0;
        let totalOnsiteIn = 0;
        let totalOnsiteOut = 0;

        fullMonthDays.forEach(day => {
            const val = emp.data[day];
            const isOffDay = isWeekend(day, currentMonth, currentYear);
            let std = 0;
            let ot = 0;
            let otWeekend = 0;
            let leave = 0;

            if (typeof val === 'number') {
                std = val;
            } else if (val && typeof val === 'object') {
                std = (val.standard || 0);
                ot = (val.ot || 0);
                otWeekend = (val.ot_weekend || 0);
                leave = (val.leave || 0);

                let onsiteHours = 0;
                if (val.onsite_mode === 2) {
                    onsiteHours = 8;
                } else if (val.onsite_mode === 1) {
                    onsiteHours = 4;
                } else if (val.onsite) {
                    onsiteHours = std;
                }

                if (onsiteHours > 0) {
                    if (val.onsite_place === 2) {
                        totalOnsiteOut += onsiteHours;
                    } else {
                        totalOnsiteIn += onsiteHours;
                    }
                }
            }

            if (isOffDay) {
                totalConvertedOT += (std + ot) * 2.0 + (otWeekend * 2.5);
            } else {
                totalStandard += std;
                totalLeaveHours += leave;
                if (ot > 0) totalConvertedOT += ot * 1.5;
                if (otWeekend > 0) totalConvertedOT += otWeekend * 2.0;
            }
        });

        const totalWork = totalStandard + totalConvertedOT + totalLeaveHours;
        const standardDaysInMonth = fullMonthDays.filter(d => !isWeekend(d, currentMonth, currentYear)).length;
        const standardHours = standardDaysInMonth * 8;

        const leaveHoursUsed = totalLeaveHours;
        const leaveHoursRemaining = emp.remaining_leave || 0;

        const currentConfig = payrollData[emp.id] || { basic: 0, allowance: 0 };
        const basicSalary = Number(currentConfig.basic || 0);
        const allowance = Number(currentConfig.allowance || 0);

        const basicWorkWage = standardHours > 0
            ? ((totalWork / standardHours) * basicSalary)
            : 0;

        const wageBeforeTax = Math.round(basicWorkWage + allowance);
        const tax = Math.round(basicWorkWage * 0.10);
        const netSalary = wageBeforeTax - tax;

        return {
            totalStandard,
            totalConvertedOT,
            totalLeaveHours,
            totalOnsiteIn,
            totalOnsiteOut,
            totalWork,
            standardDaysInMonth,
            standardHours,
            leaveHoursUsed,
            leaveHoursRemaining,
            basicSalary,
            allowance,
            wageBeforeTax,
            tax,
            netSalary,
            currentConfig
        };
    };

    const sendPayslipEmail = (emp) => {
        return new Promise((resolve, reject) => {
            if (!emp.email) {
                return resolve({ status: 'skipped', message: 'No Email' });
            }

            const stats = calculatePayrollStats(emp);
            const html = `
                <!DOCTYPE html>
                <html>
                <body style="font-family: 'Times New Roman', serif; background-color: #f4f4f4; padding: 20px; margin: 0;">
                    <div style="background-color: #ffffff; padding: 30px; max-width: 800px; margin: 0 auto; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                        
                        <!-- Header Table -->
                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 25px;">
                            <tr>
                                <td valign="middle" width="160" style="padding-right: 20px;">
                                    <img src="https://i.ibb.co/dwnJbQ6s/nhtc.png" alt="NHTC Logo" style="width: 100%; max-width: 160px; height: auto; display: block;" />
                                </td>
                                <td valign="middle" style="font-family: 'Times New Roman', serif; color: #000; padding: 0; margin: 0;">
                                    <div style="font-size: 24px; font-weight: bold; color: #000; margin: 0; padding: 0; text-align: left; line-height: 1.1;">Nhatrang Hitech company, Ltd.</div>
                                    
                                    <div style="font-size: 14px; line-height: 1.3; color: #000; margin: 0; padding: 0; text-align: left;">
                                        <div style="margin: 0; padding: 0;"><span style="text-decoration: underline;">Head office:</span> No. 152, Hoang Van Thu Street, Tay Nha Trang Ward, Khanh Hoa Province, Vietnam – 570000</div>
                                        <div style="margin: 0; padding: 0;"><span style="text-decoration: underline;">Rep. office:</span> 40/6, Lu Gia Street, Phu Tho Ward, Ho Chi Minh City, Vietnam – 705000</div>
                                        <div style="margin: 5px 0 0 0; padding: 0;">Tax code: 4201292624. &nbsp;&nbsp;&nbsp; Phone: (+84)28 3811 7975</div>
                                        <div style="margin: 0; padding: 0;"><i>Website:</i> <a href="http://nhtc.com.vn" style="color: blue; text-decoration: underline;">http://nhtc.com.vn</a> &nbsp;&nbsp;&nbsp; <i>Email:</i> <a href="mailto:info@nhtc.com.vn" style="color: blue; text-decoration: underline;">info@nhtc.com.vn</a></div>
                                    </div>
                                </td>
                            </tr>
                        </table>

                        <!-- Title -->
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="margin: 0 0 10px 0; font-size: 24px; color: #000; font-weight: bold;">PHIẾU LƯƠNG THÁNG ${currentMonth}/${currentYear}</h1>
                            <h3 style="margin: 0; font-size: 18px; color: #333; font-weight: normal;">${emp.name}</h3>
                        </div>

                        <!-- Content Table -->
                        <table width="100%" border="0" cellspacing="0" cellpadding="8" style="font-size: 14px; color: #000; border-collapse: collapse;">
                            <tr>
                                <td width="60%" style="border-bottom: 1px solid #eee;"><strong>Lương Căn Bản:</strong></td>
                                <td align="right" style="border-bottom: 1px solid #eee;">${new Intl.NumberFormat('vi-VN').format(stats.basicSalary)} VNĐ</td>
                            </tr>
                            <tr>
                                <td style="border-bottom: 1px solid #eee;"><strong>Giờ Công Chuẩn:</strong></td>
                                <td align="right" style="border-bottom: 1px solid #eee;">${stats.standardHours} giờ (${stats.standardDaysInMonth} ngày)</td>
                            </tr>
                            <tr>
                                <td style="border-bottom: 1px solid #eee;"><strong>Số Giờ Phép Dùng:</strong></td>
                                <td align="right" style="border-bottom: 1px solid #eee;">${stats.leaveHoursUsed} giờ</td>
                            </tr>
                            <tr>
                                <td style="border-bottom: 1px solid #eee;"><strong>Số Giờ Phép Còn Lại:</strong></td>
                                <td align="right" style="border-bottom: 1px solid #eee;">${stats.leaveHoursRemaining} giờ</td>
                            </tr>
                            <tr>
                                <td style="border-bottom: 1px solid #eee;"><strong>Tổng Giờ Onsite (Trong tỉnh):</strong></td>
                                <td align="right" style="border-bottom: 1px solid #eee;">${stats.totalOnsiteIn} giờ</td>
                            </tr>
                            <tr>
                                <td style="border-bottom: 1px solid #eee;"><strong>Tổng Giờ Onsite (Ngoài tỉnh):</strong></td>
                                <td align="right" style="border-bottom: 1px solid #eee;">${stats.totalOnsiteOut} giờ</td>
                            </tr>
                            <tr>
                                <td style="border-bottom: 1px solid #eee;"><strong>Tổng Giờ OT (Quy đổi):</strong></td>
                                <td align="right" style="border-bottom: 1px solid #eee;">${stats.totalConvertedOT.toFixed(1)} giờ</td>
                            </tr>
                            <tr>
                                <td style="border-bottom: 1px solid #eee;"><strong>Tổng Giờ Công:</strong></td>
                                <td align="right" style="border-bottom: 1px solid #eee;">${stats.totalWork.toFixed(1)} giờ</td>
                            </tr>
                            <tr>
                                <td style="border-bottom: 1px solid #eee;"><strong>Phụ Cấp:</strong></td>
                                <td align="right" style="border-bottom: 1px solid #eee;">${new Intl.NumberFormat('vi-VN').format(stats.allowance)} VNĐ</td>
                            </tr>
                            
                            <!-- Summary Section -->
                            <tr>
                                <td style="padding-top: 15px;"><strong>Tổng Lương (Trước Thuế):</strong></td>
                                <td align="right" style="padding-top: 15px; font-weight: bold;">${new Intl.NumberFormat('vi-VN').format(stats.wageBeforeTax)} VNĐ</td>
                            </tr>
                            <tr>
                                <td style="color: #ef4444;"><strong>Thuế TNCN (10%):</strong></td>
                                <td align="right" style="color: #ef4444;">-${new Intl.NumberFormat('vi-VN').format(stats.tax)} VNĐ</td>
                            </tr>
                        </table>

                        <!-- Net Salary -->
                        <div style="margin-top: 25px; border-top: 2px solid #333; padding-top: 15px;">
                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td style="font-size: 16px; font-weight: bold;">Lương Nhận Được:</td>
                                    <td align="right" style="font-size: 20px; font-weight: bold; color: #10b981;">${new Intl.NumberFormat('vi-VN').format(stats.netSalary)} VNĐ</td>
                                </tr>
                            </table>
                        </div>

                        <!-- Footer -->
                        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 10px;">
                            <p style="margin: 5px 0;">Email này được gửi tự động từ hệ thống NHTC Portal.</p>
                            <p style="margin: 5px 0;">Vui lòng không trả lời lại email này.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            // EmailJS Parameters
            const templateParams = {
                to_email: emp.email,
                name: emp.name,
                month: currentMonth,
                year: currentYear,
                html_content: html
            };

            emailjs.send(
                'service_sj56gyl',
                'template_8g72z8l',
                templateParams,
                'X3guyobNxV7FgA-XB'
            )
                .then((response) => {
                    resolve({ status: 'success', response });
                }, (err) => {
                    resolve({ status: 'error', error: err });
                });
        });
    };

    const handleSendAll = async () => {
        if (!confirm('Bạn có chắc chắn muốn gửi email phiếu lương cho TOÀN BỘ nhân viên có email không?')) return;

        setIsSendingAll(true);
        let sentCount = 0;
        let failCount = 0;
        let skipCount = 0;

        for (const emp of employeeData) {
            if (!emp.email) {
                skipCount++;
                continue;
            }

            // Console log progress
            console.log(`Sending to ${emp.name}...`);
            const result = await sendPayslipEmail(emp);

            if (result.status === 'success') {
                sentCount++;
            } else {
                failCount++;
                console.error(`Failed to send to ${emp.name}`, result.error);
            }
            // Small delay to be polite to API
            await new Promise(r => setTimeout(r, 3000));
        }

        setIsSendingAll(false);
        showToast(`Hoàn tất!\n- Đã gửi: ${sentCount}\n- Thất bại: ${failCount}\n- Bỏ qua (không có email): ${skipCount}`, 'info');
    };

    const handleDeleteCell = async () => {
        if (!activeCell) return;

        // Optimistic Update: Remove the key from data
        setEmployeeData(prev => prev.map(emp => {
            if (emp.id === activeCell.empId) {
                const updatedData = { ...emp.data };
                delete updatedData[activeCell.day]; // Remove entry
                return { ...emp, data: updatedData };
            }
            return emp;
        }));

        // Database Delete
        try {
            const dayStr = String(activeCell.day).padStart(2, '0');
            const monthStr = String(currentMonth).padStart(2, '0');
            const fullDate = `${currentYear}-${monthStr}-${dayStr}`;

            const { error } = await supabase
                .from('attendance')
                .delete()
                .match({ employee_id: activeCell.empId, date: fullDate });

            if (error) throw error;
            console.log("Deleted successfully");

        } catch (error) {
            console.error("Error deleting attendance:", error);
            showToast("Lỗi xoá dữ liệu: " + error.message, 'error');
        }

        setActiveCell(null);
    };

    const handleSaveCell = async (newData) => {
        if (!activeCell) return;

        // Optimistic Update
        setEmployeeData(prev => prev.map(emp => {
            if (emp.id === activeCell.empId) {
                const updatedData = { ...emp.data };
                updatedData[activeCell.day] = newData;
                return { ...emp, data: updatedData };
            }
            return emp;
        }));

        // Database Update
        try {
            // Construct Date String: YYYY-MM-DD
            const dayStr = String(activeCell.day).padStart(2, '0');
            const monthStr = String(currentMonth).padStart(2, '0');
            const fullDate = `${currentYear}-${monthStr}-${dayStr}`;

            const payload = {
                employee_id: activeCell.empId,
                date: fullDate,
                standard_hours: newData.standard,
                ot_hours: newData.ot,
                ot_weekend: newData.ot_weekend,
                leave_hours: newData.leave, // Send to DB
                is_onsite: newData.onsite_mode > 0, // Keep boolean sync
                onsite_mode: newData.onsite_mode, // New Field
                onsite_place: newData.onsite_place // Location
            };

            const { error } = await supabase
                .from('attendance')
                .upsert(payload, { onConflict: 'employee_id, date' });

            if (error) throw error;

            // Optionally refetch or rely on optimistic update
            console.log("Saved successfully");

        } catch (error) {
            console.error("Error saving attendance:", error);
            showToast("Lỗi lưu dữ liệu: " + error.message, 'error');
            // Revert changes if needed (omitted for brevity, assume simple retry)
        }

        setActiveCell(null);
    };

    const handleExportExcel = () => {
        // Headers
        const headers = [
            "STT", "Họ Tên", "Phòng Ban", "Mã NV",
            "Công (Giờ)", "Phép SD (Giờ)", "Phép tồn (Giờ)",
            "OT Thường", "OT Ngày nghỉ", "OT Q.Đổi",
            "OT tính lương", "OT tính phụ cấp",
            "Onsite Nội thành", "Onsite Ngoại thành", "Tổng công"
        ];

        fullMonthDays.forEach(day => headers.push(`Ngày ${day} `));

        const rows = employeeData.map((emp, index) => {
            let totalStandard = 0;
            let totalLeave = 0;
            let totalOT = 0;
            let totalOTWeekend = 0;
            let totalOnsiteIn = 0;
            let totalOnsiteOut = 0;
            let totalConvertedOT = 0;

            const dayValues = fullMonthDays.map(day => {
                const val = emp.data[day];
                const isOffDay = isWeekend(day, currentMonth, currentYear);

                let std = 0;
                let ot = 0;
                let otWeekend = 0;
                let leave = 0;
                let cellText = "";

                if (typeof val === 'number') {
                    std = val;
                    cellText = String(val);
                } else if (val && typeof val === 'object') {
                    std = (val.standard || 0);
                    ot = (val.ot || 0);
                    otWeekend = (val.ot_weekend || 0);
                    leave = (val.leave || 0);

                    if (leave === 8) cellText = "P_Full";
                    else if (leave === 4) cellText = "P_Half";
                    else if (val.onsite_mode === 2) cellText = "OS_Full";
                    else if (val.onsite_mode === 1) cellText = "OS_Half";
                    else {
                        if (std > 0) cellText = String(std);
                        if (ot > 0) cellText += ` OT:${ot} `;
                        if (otWeekend > 0) cellText += ` OT_W:${otWeekend} `;
                    }

                    // Onsite Split Logic
                    let osHours = 0;
                    if (val.onsite_mode === 2) osHours = 8;
                    else if (val.onsite_mode === 1) osHours = 4;
                    else if (val.onsite) osHours = std;

                    if (osHours > 0) {
                        if (val.onsite_place === 2) totalOnsiteOut += osHours;
                        else totalOnsiteIn += osHours;
                    }
                }

                if (isOffDay) {
                    totalOTWeekend += std + ot + otWeekend;
                    totalConvertedOT += (std + ot) * 2.0 + (otWeekend * 2.5);
                } else {
                    totalStandard += std;
                    totalLeave += leave;
                    totalOT += ot;
                    totalOTWeekend += otWeekend;
                    if (ot > 0) totalConvertedOT += ot * 1.5;
                    if (otWeekend > 0) totalConvertedOT += otWeekend * 2.0;
                }

                return cellText;
            });

            const totalWork = totalStandard + totalLeave + totalConvertedOT; // Note: Typically Onsite counts to Work??
            // Re-checking previous logic: "const totalWork = totalStandard + totalLeave + totalConvertedOT;"
            // Wait, does Onsite count as Standard?
            // In grid loop: "totalStandard += std;"
            // If Onsite, std usually is 8 (if onsite_mode=2). Check lines 103-115 in Step 731.
            // "empAttendance[recDay] = { standard: record.standard_hours... }"
            // If onsite, does standard_hours have value?
            // If I look at the logic in Timekeeping.jsx (Step 811):
            // "totalOnsite += 8" (for mode 2). "totalStandard" is accumulated in "else" block of "if (isOffDay)".
            // If Onsite is on Weekday, "totalStandard += std" executes.
            // If "onsite_mode === 2", is "std" 0 or 8 in the data?
            // Usually Onsite means you are working, so Standard Hours should be 8.
            // However, the "totalOnsite" calc was separate.
            // In the PREVIOUS code (Step 823):
            // "totalWork = totalStandard + totalLeave + totalConvertedOT;"
            // It did NOT add totalOnsite to totalWork explicitly.
            // So I will stick to the previous formula for totalWork to ensure consistency.

            const remainingLeave = emp.remaining_leave;

            // OT Salary / Allowance Logic
            const roundedConvertedOT = Math.round(totalConvertedOT);
            let otSalary = roundedConvertedOT;
            let otAllowance = 0;

            if (roundedConvertedOT > 39) {
                otSalary = 39;
                otAllowance = roundedConvertedOT - 39;
            }

            return [
                index + 1,
                emp.name,
                emp.dept,
                emp.code,
                Math.round(totalStandard),
                Math.round(totalLeave),      // Ensure Hours
                Math.round(remainingLeave),   // Ensure Hours
                Math.round(totalOT),
                Math.round(totalOTWeekend),
                roundedConvertedOT,
                otSalary,
                otAllowance,
                Math.round(totalOnsiteIn),
                Math.round(totalOnsiteOut),
                Math.round(totalWork),
                ...dayValues
            ];
        });

        const BOM = "\uFEFF";
        let csvContent = BOM + headers.join(",") + "\n";

        rows.forEach(row => {
            const rowStr = row.map(cell => {
                if (cell === null || cell === undefined) return "";
                const cellStr = String(cell);
                if (cellStr.includes(",") || cellStr.includes("\n") || cellStr.includes('"')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(",");
            csvContent += rowStr + "\n";
        });

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Bang_Cham_Cong_Thang_${currentMonth}_${currentYear}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div style={{
            padding: '1.5rem',
            height: '100vh',
            maxHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            boxSizing: 'border-box'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h1 style={{ fontSize: '1.8rem', color: '#1e293b', margin: 0, fontWeight: 700 }}>Chấm công</h1>
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

            {/* Sub Header & Actions */}
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>Giữ Ctrl + Click để chọn nhiều ô</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handleExportExcel}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    >
                        <Download size={16} />
                        Xuất Excel
                    </button>
                    <button
                        onClick={() => setShowPayroll(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    >
                        <FileText size={16} />
                        Tính Lương
                    </button>
                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                {/* ... existing controls ... */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowCalendar(!showCalendar)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                color: '#1e293b'
                            }}
                        >
                            <Calendar size={18} color="#64748b" />
                            <span>Tháng {currentMonth}, {currentYear}</span>
                            <ChevronRight size={16} style={{ transform: 'rotate(90deg)' }} />
                        </button>

                        {/* Calendar Popover */}
                        {showCalendar && (
                            <div style={{
                                position: 'absolute',
                                top: '110%',
                                left: 0,
                                background: '#1e293b', // Dark theme as per screenshot suggestion
                                color: 'white',
                                borderRadius: '12px',
                                padding: '16px',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                                zIndex: 100,
                                width: '280px'
                            }}>
                                {/* Header - Only Month/Year Selection */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600, fontSize: '1rem' }}>Tháng {currentMonth} {currentYear}</span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const d = new Date(currentYear, currentMonth - 2, 1);
                                                setCurrentMonth(d.getMonth() + 1);
                                                setCurrentYear(d.getFullYear());
                                            }}
                                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const d = new Date(currentYear, currentMonth, 1);
                                                setCurrentMonth(d.getMonth() + 1);
                                                setCurrentYear(d.getFullYear());
                                            }}
                                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Overlay to close */}
                    {showCalendar && (
                        <div
                            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }}
                            onClick={() => setShowCalendar(false)}
                        />
                    )}
                </div>
                <div style={{ height: '20px', width: '1px', background: '#e2e8f0' }}></div>

                {/* Search Input */}
                <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 8px', width: '250px' }}>
                    <Search size={16} color="#94a3b8" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm nhân viên..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ border: 'none', outline: 'none', padding: '8px', fontSize: '0.9rem', width: '100%', background: 'transparent' }}
                    />
                </div>

                {/* Week Selector Removed */}

                {/* Legend Removed */}
            </div>

            {/* Table Container - Removed horizontal scroll requirement since week view is compact */}
            <div style={{ flex: 1, background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                        <tr>
                            <th style={{ border: '1px solid #e2e8f0', padding: '10px', width: '40px', background: '#f1f5f9' }}>STT</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '10px', width: '180px', textAlign: 'left', background: '#f1f5f9' }}>Họ Tên</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '10px', width: '120px', textAlign: 'left', background: '#f1f5f9' }}>Phòng Ban</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '10px', width: '80px', background: '#f1f5f9' }}>Mã NV</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '10px', width: '60px', background: '#f8fafc', color: '#1e293b' }}>Công (Giờ)</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '10px', width: '60px', background: '#f8fafc', color: '#1e293b' }}>Ngày phép SD</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '10px', width: '60px', background: '#f8fafc', color: '#1e293b' }}>Ngày phép tồn</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '10px', width: '60px', background: '#f8fafc', color: '#1e293b' }}>OT Thường (Giờ)</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '10px', width: '60px', background: '#f8fafc', color: '#1e293b' }}>OT Ngày nghỉ (Giờ)</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '10px', width: '80px', background: '#fef3c7', color: '#b45309' }}>OT Q.Đổi (Giờ)</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '10px', width: '60px', background: '#dcfce7', color: '#15803d' }}>Onsite (Giờ)</th>
                            <th style={{ border: '1px solid #e2e8f0', padding: '10px', width: '70px', background: '#e0e7ff', color: '#3730a3' }}>Tổng công (Giờ)</th>
                            {/* Days Removed */}
                        </tr>
                    </thead>
                    <tbody>
                        {employeeData
                            .filter(emp =>
                                emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                emp.code.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            .map((emp, index) => (
                                <tr key={emp.id} style={{ '&:hover': { backgroundColor: '#f8fafc' } }}>
                                    <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center' }}>{index + 1}</td>
                                    <td
                                        style={{ border: '1px solid #e2e8f0', padding: '8px', fontWeight: 500, background: 'white', cursor: 'pointer', color: '#2563eb' }}
                                        onClick={() => setSelectedEmployee(emp)}
                                        title="Xem chi tiết chấm công cả tháng"
                                    >
                                        {emp.name}
                                    </td>
                                    <td style={{ border: '1px solid #e2e8f0', padding: '8px' }}>{emp.dept}</td>
                                    <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center' }}>{emp.code}</td>

                                    {/* Calculations - USE fullMonthDays for Monthly Totals */}
                                    {(() => {
                                        let totalStandard = 0;
                                        let totalLeave = 0; // Stats
                                        let totalOT = 0;
                                        let totalOTWeekend = 0;
                                        let totalOnsite = 0;
                                        let totalConvertedOT = 0;

                                        fullMonthDays.forEach(day => {
                                            const val = emp.data[day];
                                            const isOffDay = isWeekend(day, currentMonth, currentYear);

                                            let std = 0;
                                            let ot = 0;
                                            let otWeekend = 0;
                                            let leave = 0;

                                            if (typeof val === 'number') {
                                                std = val;
                                            } else if (val && typeof val === 'object') {
                                                std = (val.standard || 0);
                                                ot = (val.ot || 0);
                                                otWeekend = (val.ot_weekend || 0);
                                                leave = (val.leave || 0);

                                                // Onsite Calculation
                                                if (val.onsite_mode === 2) {
                                                    // Full Day = 8h (Fixed base, do NOT add OT)
                                                    totalOnsite += 8;
                                                } else if (val.onsite_mode === 1) {
                                                    // Half Day = 4h (Fixed base, do NOT add OT)
                                                    totalOnsite += 4;
                                                } else if (val.onsite) {
                                                    // Backward compatibility
                                                    // Only count standard hours, ignore OT for Onsite column
                                                    totalOnsite += std;
                                                }
                                            }

                                            if (isOffDay) {
                                                // Weekend: All hours count towards OT Weekend
                                                totalOTWeekend += std + ot + otWeekend;

                                                // Converted: Standard/OT * 2.0, OT_Weekend (Night?) * 2.5
                                                // Note: Assuming 'ot_weekend' field is still treated as the "higher rate" or night slot if distinct
                                                totalConvertedOT += (std + ot) * 2.0 + (otWeekend * 2.5);
                                            } else {
                                                // Weekday
                                                totalStandard += std;
                                                totalLeave += leave; // Stats
                                                totalOT += ot;
                                                totalOTWeekend += otWeekend; // Explicit OT Weekend/Night on weekday

                                                // Converted
                                                // OT (Weekday) * 1.5
                                                // OT Weekend (Night on Weekday) * 2.0
                                                if (ot > 0) totalConvertedOT += ot * 1.5;
                                                if (otWeekend > 0) totalConvertedOT += otWeekend * 2.0;
                                            }
                                        });

                                        const totalWork = totalStandard + totalLeave + totalConvertedOT;

                                        return (
                                            <>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center', fontWeight: 600, color: '#1e293b' }}>{Math.round(totalStandard)}</td>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center', fontWeight: 600, color: '#1e293b' }}>{Number((totalLeave / 8).toFixed(1))}</td>
                                                {/* Remaining Leave: (Base + Accrued) - YTD Used */}
                                                <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center', fontWeight: 600, color: '#1e293b' }}>{Number((emp.remaining_leave / 8).toFixed(1))}</td>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center', fontWeight: 600, color: '#1e293b' }}>{Math.round(totalOT)}</td>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center', fontWeight: 600, color: '#1e293b' }}>{Math.round(totalOTWeekend)}</td>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center', fontWeight: 600, color: '#b45309', background: '#fffbeb' }}>{Math.round(totalConvertedOT)}</td>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center', fontWeight: 600, color: '#15803d', background: '#f0fdf4' }}>{Math.round(totalOnsite)}</td>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center', fontWeight: 600, color: '#3730a3', background: '#e0e7ff' }}>{Math.round(totalWork)}</td>
                                            </>
                                        );
                                    })()}

                                    {/* visibleDays columns removed */}
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>

            {/* Employee Detail Modal */}
            {
                selectedEmployee && (() => {
                    const currentEmp = employeeData.find(e => e.id === selectedEmployee.id) || selectedEmployee;
                    return (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.5)',
                            zIndex: 100, // Below Popover (9999)
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <div style={{
                                background: 'white',
                                width: '95%',
                                maxWidth: '1200px',
                                maxHeight: '90vh',
                                borderRadius: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                            }}>
                                {/* Modal Header */}
                                <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>Chi tiết chấm công: {currentEmp.name}</h2>
                                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                                            Mã NV: {currentEmp.code} | Tháng {currentMonth}/{currentYear}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedEmployee(null)}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
                                    >
                                        <X size={24} />
                                    </button>
                                </div>

                                {/* Modal Content - Calendar Grid */}
                                <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
                                    {/* Days of Week Header */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', marginBottom: '10px' }}>
                                        {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((d, i) => (
                                            <div key={d} style={{ textAlign: 'center', fontWeight: 600, color: '#64748b', padding: '10px', background: i === 0 || i === 6 ? '#fef08a' : '#f1f5f9', borderRadius: '8px' }}>
                                                {d}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Calendar Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', autoRows: 'minmax(100px, auto)' }}>
                                        {(() => {
                                            const cells = [];
                                            const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 = Sunday

                                            // Padding for previous month
                                            for (let i = 0; i < firstDayIndex; i++) {
                                                cells.push(<div key={`empty-${i}`} style={{ background: 'transparent' }} />);
                                            }

                                            // Days
                                            fullMonthDays.forEach(day => {
                                                const val = currentEmp.data[day];
                                                const isOffDay = isWeekend(day, currentMonth, currentYear);
                                                const isSelected = selectedCells.includes(`${currentEmp.id}-${day}`);

                                                let std = 0;
                                                let ot = 0;
                                                let otWeekend = 0;
                                                let leave = 0;
                                                let mainText = "";
                                                let subText = "";
                                                let bgColor = isOffDay ? '#fffbeb' : 'white';
                                                let borderColor = isSelected ? '#3b82f6' : '#e2e8f0';
                                                let textColor = '#1e293b';

                                                if (typeof val === 'number') {
                                                    std = val;
                                                    mainText = std > 0 ? `${std}` : "";
                                                } else if (val && typeof val === 'object') {
                                                    std = (val.standard || 0);
                                                    ot = (val.ot || 0);
                                                    otWeekend = (val.ot_weekend || 0);
                                                    leave = (val.leave || 0);

                                                    if (leave === 8) {
                                                        mainText = "Phép";
                                                        bgColor = '#eff6ff'; // Light Blue
                                                        textColor = '#1e40af';
                                                    } else if (leave === 4) {
                                                        mainText = "Nửa phép";
                                                        subText = std > 0 ? `${std}h làm` : "";
                                                        bgColor = '#eff6ff';
                                                        textColor = '#1e40af';
                                                    } else if (val.onsite_mode === 2) {
                                                        const location = val.onsite_place === 2 ? "Ngoài tỉnh" : (val.onsite_place === 1 ? "Trong tỉnh" : "");
                                                        mainText = "Onsite";
                                                        subText = location;

                                                        // Check for OT during Onsite
                                                        const totalOT = (val.ot || 0) + (val.ot_weekend || 0);
                                                        if (totalOT > 0) {
                                                            subText += ` + ${totalOT}h OT`;
                                                            if (val.ot_weekend > 0) subText += " (CN)";
                                                        }

                                                        bgColor = '#f0fdf4'; // Light Green
                                                        textColor = '#166534';
                                                    } else if (val.onsite_mode === 1) {
                                                        const location = val.onsite_place === 2 ? "Ngoài tỉnh" : (val.onsite_place === 1 ? "Trong tỉnh" : "");
                                                        mainText = "Onsite (1/2)";
                                                        subText = location;

                                                        // Check for OT during Onsite
                                                        const totalOT = (val.ot || 0) + (val.ot_weekend || 0);
                                                        if (totalOT > 0) {
                                                            subText += ` + ${totalOT}h OT`;
                                                            if (val.ot_weekend > 0) subText += " (CN)";
                                                        }

                                                        bgColor = '#f0fdf4';
                                                        textColor = '#166534';
                                                    } else {
                                                        // Custom Display Logic
                                                        if (isOffDay) {
                                                            // Weekends: Show TOTAL hours, NO OT split
                                                            const totalHours = std + ot + otWeekend;
                                                            if (totalHours > 0) mainText = `${Math.round(totalHours)}`;
                                                        } else {
                                                            // Weekdays
                                                            const rawTotal = std + ot;

                                                            // Logic: Only show "8 + OT" if checking out AFTER 18:00
                                                            let isLateCheckout = false;
                                                            if (val.check_out) {
                                                                const [h] = val.check_out.split(':').map(Number);
                                                                if (h >= 18) isLateCheckout = true;
                                                            }

                                                            if (rawTotal > 8 && isLateCheckout) {
                                                                mainText = "8";
                                                                const otHours = Math.round(parseFloat((rawTotal - 8).toFixed(2)));

                                                                if (otHours > 0) {
                                                                    subText = `+ ${otHours} OT`;
                                                                    bgColor = '#fff1f2';
                                                                    textColor = '#b91c1c';
                                                                }
                                                            } else {
                                                                // If worked > 8 hours but left before 18:00 (e.g. came early),
                                                                // or worked < 8 hours, show the raw total.
                                                                if (rawTotal > 0) mainText = `${Math.round(rawTotal)}`;
                                                            }
                                                        }
                                                    }
                                                }

                                                // Highlight "Today" if applicable
                                                // const isToday = ... 

                                                cells.push(
                                                    <div
                                                        key={day}
                                                        onClick={(e) => handleCellClick(e, currentEmp, day)}
                                                        style={{
                                                            background: bgColor,
                                                            border: `1px solid ${borderColor}`,
                                                            borderRadius: '8px',
                                                            padding: '10px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            cursor: 'pointer',
                                                            position: 'relative',
                                                            boxShadow: isSelected ? '0 0 0 2px #3b82f6' : 'none',
                                                            transition: 'all 0.2s',
                                                            minHeight: '100px'
                                                        }}
                                                    >
                                                        {/* Date Number */}
                                                        <div style={{
                                                            fontSize: '1.1rem',
                                                            fontWeight: 700,
                                                            marginBottom: '5px',
                                                            color: isOffDay ? '#b45309' : '#64748b'
                                                        }}>
                                                            {day}
                                                        </div>

                                                        {/* Content */}
                                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                                            {mainText && (
                                                                <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#000000' }}>
                                                                    {mainText}
                                                                </div>
                                                            )}
                                                            {subText && (
                                                                <div style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 500, marginTop: '2px' }}>
                                                                    {subText}
                                                                </div>
                                                            )}

                                                            {/* Check In/Out Display in Cell */}
                                                            {val && typeof val === 'object' && (val.check_in || val.check_out) && (
                                                                <div style={{ marginTop: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#000000', display: 'flex', gap: '6px', background: '#f8fafc', padding: '4px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                                                                    {val.check_in && <span style={{ color: '#000000' }}>{val.check_in.substring(0, 5)}</span>}
                                                                    {val.check_in && val.check_out && <span style={{ color: '#000000' }}>-</span>}
                                                                    {val.check_out && <span style={{ color: '#000000' }}>{val.check_out.substring(0, 5)}</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            });

                                            return cells;
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }

            {/* Floating Selection Bar */}
            {
                selectedCells.length > 0 && !activeCell && (
                    <div style={{
                        position: 'fixed',
                        bottom: '30px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#1e293b',
                        color: 'white',
                        padding: '12px 24px',
                        borderRadius: '50px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        zIndex: 200
                    }}>
                        <span style={{ fontWeight: 600 }}>Đã chọn {selectedCells.length} ô</span>
                        <button
                            onClick={handleBulkEdit}
                            style={{ padding: '6px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 600 }}
                        >
                            Chỉnh sửa
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            style={{ padding: '6px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 600 }}
                        >
                            Xóa
                        </button>
                        <button
                            onClick={() => setSelectedCells([])}
                            style={{ padding: '6px 12px', background: '#475569', color: '#cbd5e1', border: 'none', borderRadius: '20px', cursor: 'pointer' }}
                        >
                            Hủy
                        </button>
                    </div>
                )
            }

            {/* Popover Editor */}
            {
                activeCell && (
                    <>
                        <div
                            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
                            onClick={() => setActiveCell(null)}
                        />
                        <div style={{
                            position: 'fixed',
                            top: activeCell.isBulk ? '50%' : Math.min(window.innerHeight - 480, activeCell.rect.bottom + 5),
                            left: activeCell.isBulk ? '50%' : Math.min(window.innerWidth - 350, activeCell.rect.left),
                            transform: activeCell.isBulk ? 'translate(-50%, -50%)' : 'none',
                            width: '260px',
                            background: 'white',
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            zIndex: 9999, // Ensure it's on top of everything
                            padding: '16px'
                        }}>
                            <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#1e293b' }}>
                                {activeCell.isBulk ? `Sửa chùm ${selectedCells.length} ô` : `Chấm công ngày ${activeCell.day}`}
                            </h3>

                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '4px' }}>Giờ hành chính</label>
                                <input
                                    type="number"
                                    autoFocus
                                    disabled={activeCell.data.leave === 8}
                                    value={activeCell.data.standard}
                                    onChange={(e) => setActiveCell(prev => ({ ...prev, data: { ...prev.data, standard: Number(e.target.value) } }))}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '4px',
                                        outline: 'none',
                                        background: activeCell.data.leave === 8 ? '#f1f5f9' : 'white',
                                        cursor: activeCell.data.leave === 8 ? 'not-allowed' : 'text'
                                    }}
                                />
                            </div>

                            {/* Check In / Out Display */}
                            <div style={{ marginBottom: '12px', padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>Thời gian thực tế</label>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                    <div style={{ textAlign: 'center', flex: 1 }}>
                                        <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '2px' }}>Vào (In)</span>
                                        <div style={{ fontWeight: 600, color: activeCell.data.check_in ? '#10b981' : '#cbd5e1' }}>
                                            {activeCell.data.check_in ? activeCell.data.check_in.substring(0, 5) : '--:--'}
                                        </div>
                                    </div>
                                    <div style={{ width: '1px', background: '#e2e8f0', margin: '0 10px' }}></div>
                                    <div style={{ textAlign: 'center', flex: 1 }}>
                                        <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '2px' }}>Ra (Out)</span>
                                        <div style={{ fontWeight: 600, color: activeCell.data.check_out ? '#f59e0b' : '#cbd5e1' }}>
                                            {activeCell.data.check_out ? activeCell.data.check_out.substring(0, 5) : '--:--'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '4px' }}>Chế độ nghỉ phép</label>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={activeCell.data.leave === 4}
                                            onChange={(e) => {
                                                const isChecked = e.target.checked;
                                                setActiveCell(prev => {
                                                    const isOff = isWeekend(prev.day, currentMonth, currentYear);
                                                    // Half Day -> 4h Standard. Uncheck -> Default (8h/0h)
                                                    const newStandard = isChecked ? 4 : (isOff ? 0 : 8);
                                                    return {
                                                        ...prev,
                                                        data: { ...prev.data, leave: isChecked ? 4 : 0, standard: newStandard }
                                                    };
                                                });
                                            }}
                                        />
                                        Nửa buổi
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={activeCell.data.leave === 8}
                                            onChange={(e) => {
                                                const isChecked = e.target.checked;
                                                setActiveCell(prev => {
                                                    const isOff = isWeekend(prev.day, currentMonth, currentYear);
                                                    // Full Day -> 0h Standard. Uncheck -> Default (8h/0h)
                                                    const newStandard = isChecked ? 0 : (isOff ? 0 : 8);
                                                    return {
                                                        ...prev,
                                                        data: { ...prev.data, leave: isChecked ? 8 : 0, standard: newStandard }
                                                    };
                                                });
                                            }}
                                        />
                                        Cả ngày
                                    </label>
                                </div>
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '4px' }}>Tăng ca (giờ)</label>
                                <input
                                    type="number"
                                    value={activeCell.data.ot}
                                    onChange={(e) => setActiveCell(prev => ({ ...prev, data: { ...prev.data, ot: Number(e.target.value) } }))}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none' }}
                                />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '4px' }}>Chế độ Onsite (Công tác)</label>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={activeCell.data.onsite_mode === 1}
                                            onChange={(e) => {
                                                setActiveCell(prev => ({
                                                    ...prev,
                                                    data: { ...prev.data, onsite_mode: e.target.checked ? 1 : 0 }
                                                }));
                                            }}
                                        />
                                        Nửa buổi
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={activeCell.data.onsite_mode === 2}
                                            onChange={(e) => {
                                                setActiveCell(prev => ({
                                                    ...prev,
                                                    data: { ...prev.data, onsite_mode: e.target.checked ? 2 : 0 }
                                                }));
                                            }}
                                        />
                                        Cả ngày
                                    </label>
                                </div>

                                {/* Onsite Location Options - Only show if Onsite is active */}
                                {activeCell.data.onsite_mode > 0 && (
                                    <div style={{ marginTop: '10px', paddingLeft: '10px', borderLeft: '2px solid #e2e8f0' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Địa điểm:</label>
                                        <div style={{ display: 'flex', gap: '15px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox" // Using checkbox as radio
                                                    checked={activeCell.data.onsite_place === 1}
                                                    onChange={(e) => {
                                                        setActiveCell(prev => ({
                                                            ...prev,
                                                            data: { ...prev.data, onsite_place: e.target.checked ? 1 : 0 }
                                                        }));
                                                    }}
                                                />
                                                Trong tỉnh
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={activeCell.data.onsite_place === 2}
                                                    onChange={(e) => {
                                                        setActiveCell(prev => ({
                                                            ...prev,
                                                            data: { ...prev.data, onsite_place: e.target.checked ? 2 : 0 }
                                                        }));
                                                    }}
                                                />
                                                Ngoài tỉnh
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => activeCell.isBulk ? handleBulkSave(activeCell.data) : handleSaveCell(activeCell.data)}
                                    style={{ flex: 1, background: '#10b981', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
                                >
                                    Lưu
                                </button>
                                {!activeCell.isBulk && (
                                    <button
                                        onClick={handleDeleteCell}
                                        style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
                                    >
                                        Xóa
                                    </button>
                                )}
                                <button
                                    onClick={() => setActiveCell(null)}
                                    style={{ flex: 1, background: '#f1f5f9', color: '#64748b', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
                                >
                                    Hủy
                                </button>
                            </div>
                        </div>
                    </>
                )
            }
            {/* Payroll Modal */}
            {showPayroll && (
                <div style={{ position: 'fixed', inset: 0, background: '#f8fafc', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
                    {/* Header */}
                    <div style={{ padding: '16px 24px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>Bảng Lương Tháng {currentMonth}/{currentYear}</h2>
                            <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Tính lương dựa trên chấm công và mức lương cơ bản</p>
                        </div>
                        <button
                            onClick={() => setShowPayroll(false)}
                            style={{ padding: '8px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#64748b' }}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div style={{ padding: '0 24px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            onClick={handleSendAll}
                            disabled={isSendingAll}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 16px',
                                background: isSendingAll ? '#94a3b8' : '#2563eb',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: isSendingAll ? 'not-allowed' : 'pointer',
                                fontWeight: 500
                            }}
                        >
                            {isSendingAll ? 'Đang gửi...' : 'Gửi Email Cho Tất Cả'}
                        </button>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <tr>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Nhân viên</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Lương CB</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Giờ công chuẩn</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Phép dùng</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Phép còn</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Onsite(Trong Tỉnh)</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Onsite(Ngoài Tỉnh)</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Giờ OT</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Tổng giờ công</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Phụ cấp</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Thuế (10%)</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>Lương nhận được</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employeeData.map((emp, idx) => {
                                        const {
                                            totalStandard,
                                            totalConvertedOT,
                                            totalLeaveHours,
                                            totalOnsiteIn,
                                            totalOnsiteOut,
                                            totalWork,
                                            standardDaysInMonth,
                                            standardHours,
                                            leaveHoursUsed,
                                            leaveHoursRemaining,
                                            basicSalary,
                                            allowance,
                                            wageBeforeTax,
                                            tax,
                                            netSalary,
                                            currentConfig
                                        } = calculatePayrollStats(emp);

                                        const handleSalaryChange = (field, val) => {
                                            setPayrollData(prev => {
                                                const existing = prev[emp.id] || { basic: 0, allowance: 0 };
                                                return {
                                                    ...prev,
                                                    [emp.id]: {
                                                        ...existing,
                                                        [field]: val
                                                    }
                                                };
                                            });
                                        };

                                        return (
                                            <tr key={emp.id} style={{ borderBottom: '1px solid #e2e8f0', hover: { background: '#f8fafc' } }}>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ fontWeight: 500, color: '#1e293b' }}>{emp.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{emp.code}</div>
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                    <input
                                                        type="text"
                                                        value={currentConfig.basic ? Number(currentConfig.basic).toLocaleString('en-US') : ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value.replace(/,/g, '');
                                                            if (/^\d*$/.test(val)) handleSalaryChange('basic', val);
                                                        }}
                                                        placeholder="0"
                                                        style={{ width: '100px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'right' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>{standardHours}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'center', color: '#000000' }}>{leaveHoursUsed}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'center', color: '#000000' }}>{leaveHoursRemaining}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'center', color: '#000000' }}>{totalOnsiteIn}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'center', color: '#000000' }}>{totalOnsiteOut}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'center', color: '#000000' }}>{totalConvertedOT.toFixed(1)}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#2563eb' }}>{totalWork.toFixed(1)} giờ</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                    <input
                                                        type="text"
                                                        value={currentConfig.allowance ? Number(currentConfig.allowance).toLocaleString('en-US') : ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value.replace(/,/g, '');
                                                            if (/^\d*$/.test(val)) handleSalaryChange('allowance', val);
                                                        }}
                                                        placeholder="0"
                                                        style={{ width: '100px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'right' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'center', color: '#ef4444' }}>
                                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(tax)}
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(netSalary)}
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                    <button
                                                        onClick={() => {
                                                            const w = window.open('', '_blank');
                                                            w.document.write(`
                                                                <html>
                                                                <head>
                                                                    <title>Phiếu Lương - ${emp.name}</title>
                                                                    <style>
                                                                        body { font-family: 'Times New Roman', serif; padding: 40px; }
                                                                        .header-container { display: flex; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 20px; }
                                                                        .logo-box { width: 30%; }
                                                                        .info-box { width: 70%; padding-left: 20px; font-size: 14px; }
                                                                        .info-box h2 { margin: 0 0 10px 0; font-size: 24px; font-weight: bold; color: #000; font-family: 'Times New Roman', serif; }
                                                                        .info-box p { margin: 4px 0; }
                                                                        .title-section { text-align: center; margin-bottom: 30px; }
                                                                        .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 15px; }
                                                                        .total { margin-top: 20px; font-size: 1.2em; font-weight: bold; border-top: 1px solid #ccc; padding-top: 10px; }
                                                                    </style>
                                                                </head>
                                                                <body>
                                                                    <div class="header-container">
                                                                        <div class="logo-box">
                                                                            <img src="${window.location.origin}/nhtc.png" alt="Logo" style="width: 100%; max-width: 150px;" />
                                                                        </div>
                                                                        <div class="info-box">
                                                                            <h2>Nhatrang Hitech company, Ltd.</h2>
                                                                            <p><span style="text-decoration: underline;">Head office:</span> No. 152, Hoang Van Thu Street, Tay Nha Trang Ward, Khanh Hoa Province, Vietnam – 570000</p>
                                                                            <p><span style="text-decoration: underline;">Rep. office:</span> 40/6, Lu Gia Street, Phu Tho Ward, Ho Chi Minh City, Vietnam – 705000</p>
                                                                            <div style="display: flex; gap: 40px;">
                                                                                <p>Tax code: 4201292624.</p>
                                                                                <p>Phone: (+84)28 3811 7975</p>
                                                                            </div>
                                                                            <div style="display: flex; gap: 40px;">
                                                                                <p>Website: <a href="http://nhtc.com.vn" style="color: blue; text-decoration: none;">http://nhtc.com.vn</a></p>
                                                                                <p>Email: <a href="mailto:info@nhtc.com.vn" style="color: blue; text-decoration: none;">info@nhtc.com.vn</a></p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div class="title-section">
                                                                        <h1>PHIẾU LƯƠNG THÁNG ${currentMonth}/${currentYear}</h1>
                                                                        <h3>${emp.name}</h3>
                                                                    </div>
                                                                    <div class="row"><span>Lương Căn Bản:</span> <span>${new Intl.NumberFormat('vi-VN').format(basicSalary)} VNĐ</span></div>
                                                                    <div class="row"><span>Giờ Công Chuẩn:</span> <span>${standardHours} giờ (${standardDaysInMonth} ngày)</span></div>
                                                                    <div class="row"><span>Số Giờ Phép Dùng:</span> <span>${leaveHoursUsed} giờ</span></div>
                                                                    <div class="row"><span>Số Giờ Phép Còn Lại:</span> <span>${leaveHoursRemaining} giờ</span></div>
                                                                    <div class="row"><span>Tổng Giờ Onsite (Trong tỉnh):</span> <span>${totalOnsiteIn} giờ</span></div>
                                                                    <div class="row"><span>Tổng Giờ Onsite (Ngoài tỉnh):</span> <span>${totalOnsiteOut} giờ</span></div>
                                                                    <div class="row"><span>Tổng Giờ OT (Quy đổi):</span> <span>${totalConvertedOT.toFixed(1)} giờ</span></div>
                                                                    <div class="row"><span>Tổng Giờ Công:</span> <span>${totalWork.toFixed(1)} giờ</span></div>
                                                                    <div class="row"><span>Phụ Cấp:</span> <span>${new Intl.NumberFormat('vi-VN').format(allowance)} VNĐ</span></div>
                                                                    <div class="row" style="border-top: 1px dashed #ccc; margin-top: 5px; padding-top: 5px;"><span>Tổng Lương (Trước Thuế):</span> <span>${new Intl.NumberFormat('vi-VN').format(wageBeforeTax)} VNĐ</span></div>
                                                                    <div class="row"><span>Thuế TNCN (10%):</span> <span>-${new Intl.NumberFormat('vi-VN').format(tax)} VNĐ</span></div>
                                                                    <div class="row total"><span>Lương Nhận Được:</span> <span>${new Intl.NumberFormat('vi-VN').format(netSalary)} VNĐ</span></div>
                                                                    <br/><br/>

                                                                </body>
                                                                </html>
                                                            `);
                                                            w.document.close();
                                                            w.print();
                                                        }}
                                                        style={{ padding: '6px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                    >
                                                        In Phiếu
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            const btn = e.target;
                                                            const originalText = btn.innerText;

                                                            if (!emp.email) {
                                                                showToast('Lỗi: Nhân viên chưa có email!', 'error');
                                                                return;
                                                            }

                                                            btn.innerText = "Đang gửi...";
                                                            btn.disabled = true;
                                                            btn.style.opacity = '0.7';

                                                            sendPayslipEmail(emp).then(result => {
                                                                if (result.status === 'success') {
                                                                    showToast(`Đã gửi email thành công cho ${emp.name}!`, 'success');
                                                                } else {
                                                                    showToast('Gửi thất bại. Vui lòng thử lại.', 'error');
                                                                }
                                                            }).finally(() => {
                                                                btn.innerText = originalText;
                                                                btn.disabled = false;
                                                                btn.style.opacity = '1';
                                                            });
                                                        }}
                                                        style={{ marginLeft: '5px', padding: '6px 10px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                    >
                                                        Gửi Email
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            {/* Toast Notification */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    zIndex: 99999,
                    background: 'white',
                    padding: '16px 20px',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    alignItems: 'start',
                    gap: '12px',
                    minWidth: '320px',
                    maxWidth: '400px',
                    borderLeft: `5px solid ${toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#3b82f6'}`,
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    <style>{`
                        @keyframes slideIn {
                            from { transform: translateX(100%); opacity: 0; }
                            to { transform: translateX(0); opacity: 1; }
                        }
                    `}</style>
                    <div style={{ marginTop: '2px' }}>
                        {toast.type === 'success' && <CheckCircle size={20} color="#10b981" />}
                        {toast.type === 'error' && <AlertCircle size={20} color="#ef4444" />}
                        {(toast.type === 'info' || toast.type === 'warning') && <Info size={20} color="#3b82f6" />}
                    </div>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
                            {toast.type === 'success' ? 'Thành công' : toast.type === 'error' ? 'Lỗi' : 'Thông báo'}
                        </h4>
                        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748b', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{toast.message}</p>
                    </div>
                    <button
                        onClick={() => setToast(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0' }}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default Timekeeping;
