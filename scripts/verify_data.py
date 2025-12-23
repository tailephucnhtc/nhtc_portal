import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL') or os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_ANON_KEY') or os.getenv('SUPABASE_KEY')

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def verify():
    # Fetch today's attendance to see if check_in/out exists
    res = supabase.table('attendance').select('*').limit(5).order('date', desc=True).execute()
    for row in res.data:
        print(f"Date: {row.get('date')}, EmpID: {row.get('employee_id')}")
        print(f"  CheckIn: {row.get('check_in')}")
        print(f"  CheckOut: {row.get('check_out')}")
        print("-" * 20)

if __name__ == "__main__":
    verify()
