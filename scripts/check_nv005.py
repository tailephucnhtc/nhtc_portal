import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL') or os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_ANON_KEY') or os.getenv('SUPABASE_KEY')

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_nv005():
    # 1. Get Employee ID for NV005
    res_emp = supabase.table('employees').select('id, full_name').eq('employee_code', 'NV005').execute()
    
    if not res_emp.data:
        print("Employee NV005 not found!")
        return

    emp = res_emp.data[0]
    print(f"Checking attendance for: {emp['full_name']} (NV005)")
    print("-" * 30)

    # 2. Get Attendance
    res_att = supabase.table('attendance') \
        .select('*') \
        .eq('employee_id', emp['id']) \
        .order('date', desc=True) \
        .execute()

    if not res_att.data:
        print("No attendance records found.")
    else:
        for row in res_att.data:
            print(f"Date: {row['date']}")
            print(f"  Check In : {row.get('check_in', 'N/A')}")
            print(f"  Check Out: {row.get('check_out', 'N/A')}")
            print(f"  Hours    : {row.get('standard_hours', 0)}")
            print("-" * 20)

if __name__ == "__main__":
    check_nv005()
