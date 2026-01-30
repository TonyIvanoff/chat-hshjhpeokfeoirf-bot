
import os
import shutil
import json

SOURCE_DIR = "./fonts"
DEST_DIR = "./frontend/public/fonts"
CSS_FILE = "./frontend/app/fonts.css"
TS_LIST_FILE = "./frontend/lib/fonts.ts"

# Ensure dest dir exists
os.makedirs(DEST_DIR, exist_ok=True)
os.makedirs(os.path.dirname(TS_LIST_FILE), exist_ok=True)

font_families = []
css_content = ""

# Common system fonts to keep at the top
STANDARD_FONTS = ["Arial", "Times New Roman", "Courier New", "Roboto", "Lato", "Montserrat"]

for filename in sorted(os.listdir(SOURCE_DIR)):
    if filename.lower().endswith(".otf"):
        # Copy file
        shutil.copy2(os.path.join(SOURCE_DIR, filename), os.path.join(DEST_DIR, filename))
        
        # Determine font family name (basename without extension)
        font_name = os.path.splitext(filename)[0]
        # Clean up name if needed (e.g. CamelCase to spaced?) 
        # For now, let's keep it as is or maybe split by capital letters if desired, 
        # but usually font names in select boxes mimic the file/font name. 
        # Let's just use the filename base.
        
        font_families.append(font_name)
        
        # Create @font-face rule
        # URL path is relative to the CSS file location or absolute from public root. 
        # In Next.js, things in public/ are served at root.
        rule = f"""
@font-face {{
  font-family: '{font_name}';
  src: url('/fonts/{filename}') format('opentype');
  font-display: swap;
}}
"""
        css_content += rule

# Write CSS
with open(CSS_FILE, "w") as f:
    f.write(css_content)

# Write TS List
all_fonts = STANDARD_FONTS + font_families
# Filter duplicates just in case
all_fonts = sorted(list(set(all_fonts)))

ts_content = f"""
// Auto-generated font list
export const FONT_FAMILIES = {json.dumps(all_fonts, indent=4)};
"""

with open(TS_LIST_FILE, "w") as f:
    f.write(ts_content)

print(f"Processed {len(font_families)} fonts.")
