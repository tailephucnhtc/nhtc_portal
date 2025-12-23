import os
import pyodbc
from datetime import datetime, date
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# 1. Configuration
# Note: Driver might need to be adjusted based on installed drivers.
# Common drivers: 'ODBC Driver 17 for SQL Server', 'SQL Server Native Client 11.0'
SQL_DRIVER = '{ODBC Driver 17 for SQL Server}'
SQL_SERVER = os.getenv('SQL_SERVER', '(localdb)\\SQLVIETINSOFT')
SQL_DATABASE = os.getenv('SQL_DATABASE', 'Paradise_FREE')

CONN_STR = (
    f"DRIVER={SQL_DRIVER};"
    f"SERVER={SQL_SERVER};"
    f"DATABASE={SQL_DATABASE};"
    "Trusted_Connection=yes;"
)

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL') or os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_ANON_KEY') or os.getenv('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_KEY are required.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 2. User ID Mapping
USER_MAPPING = {
    0: 'NV010', 1: 'NV019', 2: 'NV015', 3: 'NV012', 4: 'NV002',
    5: 'NV013', 6: 'NV009', 7: 'NV005', 8: 'NV008', 9: 'NV001',
    10: 'NV003', 11: 'NV006', 12: 'NV017', 13: 'NV016', 14: 'NV004',
    15: 'NV014', 16: 'NV007', 17: 'NV011'
}

def main():
    conn = None
    try:
        print("Connecting to SQL Server...")
        conn = pyodbc.connect(CONN_STR)
        cursor = conn.cursor()
        print("Connected!")

        print("Syncing data for TODAY...")
        
        today_date = datetime.now().date()
        date_str = today_date.strftime('%Y-%m-%d')
        
        # Start and End of TODAY
        start_of_day = datetime.combine(today_date, datetime.min.time())
        end_of_day = datetime.combine(today_date, datetime.max.time())

        query = """
            SELECT UserID, CheckTime 
            FROM dbo.CHECKINOUT 
            WHERE CheckTime >= ? AND CheckTime <= ?
            ORDER BY CheckTime ASC
        """
        
        cursor.execute(query, start_of_day, end_of_day)
        rows = cursor.fetchall()
        
        print(f"Found {len(rows)} records in SQL Server.")

        if not rows:
            print("No data to sync.")
            return

        # Fetch Employees from Supabase
        res = supabase.table('employees').select('id, employee_code').execute()
        employees = res.data
        
        emp_map = {e['employee_code']: e['id'] for e in employees}

        valid_logs = []
        processed_emp_ids = set()

        for row in rows:
            user_id = row.UserID
            check_time = row.CheckTime
            
            # Map UserID to EmpCode
            emp_code = USER_MAPPING.get(user_id)
            if not emp_code:
                continue
                
            emp_id = emp_map.get(emp_code)
            if not emp_id:
                # print(f"Warning: Employee code {emp_code} not found in Supabase.")
                continue

            # CheckTime from pyodbc is datetime object
            # Convert to ISO format string
            check_time_iso = check_time.isoformat()

            valid_logs.append({
                "employee_id": emp_id,
                "check_time": check_time_iso,
                "created_at": datetime.now().isoformat()
            })
            
            processed_emp_ids.add(emp_id)

        print(f"Prepared {len(valid_logs)} valid logs for Supabase.")

        if valid_logs:
            # A. FORCE CLEAR TODAY'S DATA ONLY
            # To ensure no stale data remains from previous runs for today
            
            print(f"Clearing old raw logs for {date_str}...")
            supabase.table('attendance_raw').delete().gte('check_time', start_of_day.isoformat()).lte('check_time', end_of_day.isoformat()).execute()
            
            # Also clear the summary table for TODAY
            print(f"Clearing attendance summary for {date_str}...")
            supabase.table('attendance').delete().eq('date', date_str).execute()
            
            # B. Insert Raw Logs
            # Batch insert (Supabase limit is usually high, but let's be safe if huge data)
            chunk_size = 1000
            for i in range(0, len(valid_logs), chunk_size):
                chunk = valid_logs[i:i + chunk_size]
                supabase.table('attendance_raw').insert(chunk).execute()
            
            print(f"Inserted {len(valid_logs)} raw logs.")

            # C. Calculate Attendance Summary
            # Need to group by (Employee, Date)
            # valid_logs already has 'check_time' as ISO string.
            
            summary_map = {} # Key: (emp_id, date_str) -> [times]

            for log in valid_logs:
                e_id = log['employee_id']
                # Parse ISO back to datetime
                dt = datetime.fromisoformat(log['check_time'])
                d_str = dt.strftime('%Y-%m-%d')
                
                key = (e_id, d_str)
                if key not in summary_map:
                    summary_map[key] = []
                summary_map[key].append(dt)

            attendance_updates = []

            for (emp_id, day_str), times in summary_map.items():
                times.sort()
                
                check_in_dt = times[0]
                check_out_dt = times[-1]
                
                check_in_str = check_in_dt.strftime('%H:%M:%S')
                check_out_str = None
                standard_hours = 0.0
                ot_hours = 0.0

                if len(times) > 1 and check_out_dt > check_in_dt:
                    check_out_str = check_out_dt.strftime('%H:%M:%S')
                    diff = check_out_dt - check_in_dt
                    total_hours = diff.total_seconds() / 3600
                    
                    # Deduct 1 hour for lunch if working more than 4 hours
                    if total_hours > 4:
                        standard_hours = round(total_hours - 1, 2)
                    else:
                        standard_hours = round(total_hours, 2)
                    
                    if standard_hours > 8:
                        standard_hours = 8.0
                    
                    if standard_hours < 0: standard_hours = 0

                    # OT LOGIC:
                    # If check_out is after 18:00, count everything above 8h as OT.
                    # Base net hours = total_hours - 1 (lunch)
                    # We use the raw calculated hours for OT base.
                    ot_hours = 0.0
                    if check_out_dt.hour >= 18:
                         # Calculate raw net hours again to be sure
                         raw_net_hours = total_hours - 1 if total_hours > 4 else total_hours
                         if raw_net_hours > 8:
                             ot_hours = round(raw_net_hours - 8, 2)
                
                attendance_updates.append({
                    "employee_id": emp_id,
                    "date": day_str,
                    "check_in": check_in_str,
                    "check_out": check_out_str,
                    "standard_hours": standard_hours,
                    "ot_hours": ot_hours
                })

            print(f"Updating attendance summary for {len(attendance_updates)} records...")
            
            # Upsert in chunks
            for i in range(0, len(attendance_updates), chunk_size):
                chunk = attendance_updates[i:i + chunk_size]
                supabase.table('attendance').upsert(chunk, on_conflict='employee_id, date').execute()
            
            print("Attendance summary updated successfully!")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    main()
