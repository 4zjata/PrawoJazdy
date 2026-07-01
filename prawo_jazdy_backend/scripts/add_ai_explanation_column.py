import sqlite3
import os

def upgrade_database():
    db_path = os.path.join(os.path.dirname(__file__), "..", "prawo_jazdy.db")
    print(f"Connecting to database at {db_path}...")
    
    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Sprawdzamy czy kolumna juz istnieje
        cursor.execute("PRAGMA table_info(questions);")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "ai_explanation" in columns:
            print("Column 'ai_explanation' already exists in 'questions' table.")
        else:
            print("Adding 'ai_explanation' column to 'questions' table...")
            cursor.execute("ALTER TABLE questions ADD COLUMN ai_explanation TEXT;")
            conn.commit()
            print("Success! Column added.")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    upgrade_database()
