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

def check_userid_8():
    conn = None
    try:
        print("Connecting to SQL Server...")
        conn = pyodbc.connect(CONN_STR)
        cursor = conn.cursor()
        print("Connected!")

        print("Querying records for UserID = 8...")
        query = "SELECT UserID, CheckTime FROM dbo.CHECKINOUT WHERE UserID = 8 ORDER BY CheckTime DESC"
        cursor.execute(query)
        rows = cursor.fetchall()

        print(f"Found {len(rows)} records for UserID 8.")
        
        # Print first 20 records
        for i, row in enumerate(rows[:20]):
            print(f"{i+1}. UserID: {row.UserID}, CheckTime: {row.CheckTime}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    check_userid_8()
