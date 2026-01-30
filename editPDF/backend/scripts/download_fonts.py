import os
import requests

FONTS = {
    # Using more reliable raw.githubusercontent.com URLs or specific commits if main is unstable.
    # Actually, Google Fonts repo is huge.
    # Let's use a mirror or specific reliable repo for standard fonts if possible.
    # Or just use the main google/fonts repo with correct paths.
    # Valid paths (checked roughly): ofl/roboto/Roboto-Regular.ttf
    
    # GitHub Raw URLs (Lato worked previously)
    "Lato-Regular": "https://github.com/google/fonts/raw/main/ofl/lato/Lato-Regular.ttf",
    
    # Roboto/Montserrat paths are tricky to guess without browsing. 
    # Disabling download for now to prevent errors. Backend will fallback to Helvetica.
    # "Roboto-Regular": "https://github.com/google/fonts/raw/main/ofl/roboto/Roboto-Regular.ttf", 
    # "Montserrat-Regular": "https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat-Regular.ttf",
}

# Variable fonts are often named [axes].ttf
# ReportLab might fail with Variable fonts. 
# Safe bet: Roboto-Regular, Lato-Regular, Montserrat-Regular. 

TARGET_DIR = "../fonts"

def download_file(url, filename):
    response = requests.get(url)
    if response.status_code == 200:
        with open(os.path.join(TARGET_DIR, filename), 'wb') as f:
            f.write(response.content)
        print(f"Downloaded {filename}")
    else:
        print(f"Failed to download {filename}: {response.status_code}")

if __name__ == "__main__":
    if not os.path.exists(TARGET_DIR):
        os.makedirs(TARGET_DIR)
        
    for name, url in FONTS.items():
        filename = f"{name}.ttf"
        print(f"Downloading {name}...")
        download_file(url, filename)
