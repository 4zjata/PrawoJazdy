import os
import json
import time
import requests
import logging
import random

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("FixImages")

def fix_images():
    with open("znaki_drogowe_db.json", "r", encoding="utf-8") as f:
        db = json.load(f)
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 PrawoJazdyApp/1.0",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8"
    }
    
    output_dir = "znaki_drogowe_img"
    fixed = 0
    total_broken = 0
    
    for item in db:
        file_name = item["plik"]
        img_url = item["img_url"]
        
        if img_url.startswith("//"):
            img_url = "https:" + img_url
            
        file_path = os.path.join(output_dir, file_name)
        
        needs_download = False
        if not os.path.exists(file_path):
            needs_download = True
        else:
            size = os.path.getsize(file_path)
            if size == 1965 or size < 2000:
                needs_download = True
                
        if needs_download:
            total_broken += 1
            max_retries = 3
            for attempt in range(max_retries):
                logger.info(f"Pobieranie {file_name} z {img_url} (Próba {attempt+1}/{max_retries})...")
                try:
                    resp = requests.get(img_url, headers=headers, timeout=10)
                    if resp.status_code == 200:
                        with open(file_path, "wb") as f:
                            f.write(resp.content)
                        logger.info(f"Sukces: Zapisano {file_name}")
                        fixed += 1
                        break
                    elif resp.status_code == 429:
                        wait_time = int(resp.headers.get("Retry-After", 15))
                        logger.warning(f"Błąd 429: Za szybko (Rate Limit). Czekam {wait_time} sekund.")
                        time.sleep(wait_time)
                        continue
                    else:
                        logger.error(f"Błąd {resp.status_code} podczas pobierania {file_name}")
                        break
                except Exception as e:
                    logger.error(f"Wyjątek {e} przy pliku {file_name}")
                    
            # Human-like delay 
            sleep_time = random.uniform(3.0, 6.0)
            logger.info(f"Czekam {sleep_time:.2f} s przed następnym żądaniem...")
            time.sleep(sleep_time)
            
    logger.info(f"Zakńczono! Naprawiono {fixed}/{total_broken} wadliwych grafik.")

if __name__ == "__main__":
    fix_images()
