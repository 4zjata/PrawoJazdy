import os
import json
import requests
from bs4 import BeautifulSoup

def main():
    # URL do artykułu Wikipedii zawierającego obowiązujące w Polsce znaki.
    url = "https://pl.wikipedia.org/wiki/Wzory_znak%C3%B3w_i_sygna%C5%82%C3%B3w_drogowych_w_Polsce"
    
    # Inicjujemy nagłówek User-Agent. Serwery Wikimedia blokują żądania 
    # generowane przez domyślne nagłówki bibliotek (np. python-requests/2.x) 
    # w celu zabezpieczenia przed zmasowanym ruchem botów.
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    print("[*] Pobieranie struktury strony (DOM)...")
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    
    # BeautifulSoup przetwarza surowy HTML na drzewo nawigowalne DOM.
    soup = BeautifulSoup(response.text, "html.parser")
    
    # Mechanika: W silniku MediaWiki zbiory zdjęć organizowane są w postaci 
    # list, gdzie każdy kafelek to element <li> z klasą "gallerybox".
    # Targetowanie tej klasy pozwala precyzyjnie wyodrębnić tylko znaki, 
    # ignorując resztę grafik interfejsowych.
    gallery_boxes = soup.find_all("li", class_="gallerybox")
    
    db = []
    output_dir = "znaki_drogowe_img"
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"[*] Wykryto {len(gallery_boxes)} elementów. Pobieranie danych...")
    
    for box in gallery_boxes:
        img_tag = box.find("img")
        text_div = box.find("div", class_="gallerytext")
        
        if img_tag and text_div:
            img_url = img_tag.get("src")
            
            # Mechanika: Wikipedia korzysta z Protocol-relative URLs (linki bez schematu 'https:').
            # Przeglądarka sama dobiera ten sam protokół co strona bazowa, ale my
            # wykonując osobne żądania HTTP, musimy ręcznie określić pełen schemat przed URI.
            if img_url.startswith("//"):
                img_url = "https:" + img_url
                
            # Wykorzystujemy get_text(strip=True, separator=" ") aby pominąć ewentualne
            # węzły HTML w opisie (np. tagi <b> dla numeracji) bez zaburzania białych znaków.
            description = text_div.get_text(separator=" ", strip=True)
            safe_name = description.split(" ")[0].replace("/", "_")
            
            # Wyodrębnianie rozszerzenia i zapobieganie błędom w ścieżkach
            file_extension = img_url.split(".")[-1].split("?")[0]
            if len(file_extension) > 4:  
                file_extension = "png"
                
            file_name = f"{safe_name}.{file_extension}"
            file_path = os.path.join(output_dir, file_name)
            
            # Zapis metadanych do zmiennej w strukturze słownikowej
            db.append({
                "kod_znaku": safe_name,
                "opis": description,
                "img_url": img_url,
                "plik": file_name
            })
            
            # Zrzut binarnego strumienia pamięci prosto do pliku
            try:
                img_data = requests.get(img_url, headers=headers).content
                with open(file_path, "wb") as f:
                    f.write(img_data)
            except Exception as e:
                print(f"[-] Błąd pobierania grafiki z {img_url}: {e}")

    # Mechanika: Słownik w Pythonie bezpośrednio rzutuje się na format JSON.
    # Używamy ensure_ascii=False, by biblioteka json używała natywnego kodowania 
    # UTF-8 zamiast sekwencji ucieczki \u dla liter z polskimi znakami diakrytycznymi.
    with open("znaki_drogowe_db.json", "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=4)
        
    print(f"[+] Gotowe. Zapisano bazę zawierającą {len(db)} obiektów.")

if __name__ == "__main__":
    main()

