// Export to Excel (CSV)
const handleExportExcel = () => {
    // Headers
    const headers = [
        "STT", "Họ Tên", "Phòng Ban", "Mã NV",
        "Công", "Phép SD", "Phép tồn",
        "OT Thường", "OT Ngày nghỉ", "OT Q.Đổi", "Onsite", "Tổng công"
    ];

    // Add Days Header
    fullMonthDays.forEach(day => headers.push(`Ngày ${day}`));

    // Rows
    const rows = employeeData.map((emp, index) => {
        let totalStandard = 0;
        let totalLeave = 0;
        let totalOT = 0;
        let totalOTWeekend = 0;
        let totalOnsite = 0;
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

                // Logic for Cell Text in CSV
                if (leave === 8) cellText = "P_Full";
                else if (leave === 4) cellText = "P_Half";
                else if (val.onsite_mode === 2) cellText = "OS_Full";
                else if (val.onsite_mode === 1) cellText = "OS_Half";
                else {
                    if (std > 0) cellText = String(std);
                    if (ot > 0) cellText += `\nOT:${ot}`;
                    if (otWeekend > 0) cellText += `\nOT_W:${otWeekend}`;
                }

                // Onsite Calc
                if (val.onsite_mode === 2) totalOnsite += 8;
                else if (val.onsite_mode === 1) totalOnsite += 4;
                else if (val.onsite) totalOnsite += std;
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

        const totalWork = totalStandard + totalLeave + totalConvertedOT;
        const remainingLeave = (emp.leave_quota || 96) - totalLeave;

        return [
            index + 1,
            emp.name,
            emp.dept,
            emp.code,
            totalStandard,
            totalLeave,
            remainingLeave,
            totalOT,
            totalOTWeekend,
            totalConvertedOT,
            totalOnsite,
            totalWork,
            ...dayValues
        ];
    });

    // Generate CSV Content with BOM
    const BOM = "\uFEFF";
    let csvContent = BOM + headers.join(",") + "\n";

    rows.forEach(row => {
        // Escape commas and quotes
        const rowStr = row.map(cell => {
            if (typeof cell === 'string') {
                const escaped = cell.replace(/"/g, '""');
                if (escaped.includes(",") || escaped.includes("\n")) return `"${escaped}"`;
                return escaped;
            }
            return cell;
        }).join(",");
        csvContent += rowStr + "\n";
    });

    // Trigger Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bang_Cham_Cong_Thang_${currentMonth}_${currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
