import fitz

pdf_path = "uploads/page10.pdf"
doc = fitz.open(pdf_path)
page = doc[0]

print(f"Inspecting Page 0 of {pdf_path}")
image_list = page.get_image_info(xrefs=True)

for img in image_list:
    xref = img['xref']
    print(f"Image Xref: {xref}")
    try:
        base = doc.extract_image(xref)
        print(f"  Ext: {base['ext']}")
        print(f"  Colorspace: {base['colorspace']}")
        print(f"  SMask (Mask Xref): {base['smask']}")
        
        # Check if we can build a pixmap
        pix = fitz.Pixmap(doc, xref)
        print(f"  Pixmap Alpha: {pix.alpha}")
        print(f"  Pixmap n (channels): {pix.n}")
        
    except Exception as e:
        print(f"  Error: {e}")
    print("-" * 20)
