import os
import pyodbc
from dotenv import load_dotenv

load_dotenv()

SQL_DRIVER = '{ODBC Driver 17 for SQL Server}'
SQL_SERVER = os.getenv('SQL_SERVER', '(localdb)\\SQLVIETINSOFT')
SQL_DATABASE = os.getenv('SQL_DATABASE', 'Paradise_FREE')

CONN_STR = (
    f"DRIVER={SQL_DRIVER};"
    f"SERVER={SQL_SERVER};"
    f"DATABASE={SQL_DATABASE};"
    "Trusted_Connection=yes;"
)

def check_jan_4():
    conn = None
    try:
        print("Connecting to SQL Server...")
        conn = pyodbc.connect(CONN_STR)
        cursor = conn.cursor()
        print("Connected!")

        target_date = '2025-12-31'
        print(f"Querying records for Date: {target_date}...")
        
        query = "SELECT UserID, CheckTime FROM dbo.CHECKINOUT WHERE CAST(CheckTime AS DATE) = ? ORDER BY CheckTime ASC"
        cursor.execute(query, target_date)
        rows = cursor.fetchall()

        print(f"Found {len(rows)} records on {target_date}.")
        
        unique_users = set()
        for row in rows:
            unique_users.add(row.UserID)
            print(f"UserID: {row.UserID}, Time: {row.CheckTime}")

        print("-" * 20)
        print(f"Unique UserIDs present: {sorted(list(unique_users))}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    check_jan_4()
