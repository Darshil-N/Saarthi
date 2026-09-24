import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "demo_assets", "bills")
os.makedirs(OUT_DIR, exist_ok=True)

FONT_DIR = "C:/Windows/Fonts"
F_REG = os.path.join(FONT_DIR, "arial.ttf")
F_BOLD = os.path.join(FONT_DIR, "arialbd.ttf")
F_MONO = os.path.join(FONT_DIR, "consola.ttf")


def f(path, size):
    return ImageFont.truetype(path, size)


def draw_bill(filename, vendor, vendor_addr, gstin, invoice_no, date, po_no, items, bill_to="BharatOil Refinery — Central Stores, Plot 14, Industrial Area, Vadodara, Gujarat 390010"):
    W, H = 1240, 1600
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)

    # Header band
    d.rectangle([0, 0, W, 140], fill=(20, 40, 70))
    d.text((50, 35), vendor, font=f(F_BOLD, 40), fill="white")
    d.text((50, 90), vendor_addr, font=f(F_REG, 18), fill=(210, 220, 235))

    y = 170
    d.text((50, y), f"GSTIN: {gstin}", font=f(F_REG, 18), fill="black")
    d.text((650, y), f"Invoice No: {invoice_no}", font=f(F_BOLD, 18), fill="black")
    y += 30
    d.text((650, y), f"Date: {date}", font=f(F_REG, 18), fill="black")
    y += 30
    d.text((650, y), f"PO No: {po_no}", font=f(F_REG, 18), fill="black")

    y = 170
    d.text((50, y + 60), "Bill To:", font=f(F_BOLD, 18), fill="black")
    d.multiline_text((50, y + 90), bill_to, font=f(F_REG, 16), fill="black", spacing=6)

    y = 340
    d.line([(50, y), (W - 50, y)], fill=(20, 40, 70), width=2)
    y += 20

    cols = [("#", 50, 40), ("Description", 100, 560), ("Qty", 670, 80), ("Unit", 760, 80), ("Rate (INR)", 850, 150), ("Amount (INR)", 1010, 180)]
    for label, x, w in cols:
        d.text((x, y), label, font=f(F_BOLD, 16), fill="white")
    d.rectangle([50, y - 6, W - 50, y + 26], fill=(20, 40, 70))
    for label, x, w in cols:
        d.text((x, y), label, font=f(F_BOLD, 16), fill="white")
    y += 40

    total = 0.0
    for idx, (desc, qty, unit, rate) in enumerate(items, start=1):
        amount = qty * rate
        total += amount
        row_fill = (245, 247, 250) if idx % 2 == 0 else "white"
        d.rectangle([50, y - 8, W - 50, y + 46], fill=row_fill)
        d.text((60, y), str(idx), font=f(F_MONO, 16), fill="black")
        d.multiline_text((100, y), desc, font=f(F_REG, 15), fill="black", spacing=4)
        d.text((670, y), str(qty), font=f(F_MONO, 16), fill="black")
        d.text((760, y), unit, font=f(F_MONO, 16), fill="black")
        d.text((850, y), f"{rate:,.2f}", font=f(F_MONO, 16), fill="black")
        d.text((1010, y), f"{amount:,.2f}", font=f(F_MONO, 16), fill="black")
        y += 60

    y += 20
    d.line([(650, y), (W - 50, y)], fill=(20, 40, 70), width=2)
    y += 20
    d.text((850, y), "Grand Total:", font=f(F_BOLD, 18), fill="black")
    d.text((1010, y), f"INR {total:,.2f}", font=f(F_BOLD, 18), fill=(20, 40, 70))

    y += 80
    d.text((50, y), "Terms: Payment due within 30 days. Goods inspected and accepted subject to quality check on receipt.",
            font=f(F_REG, 14), fill=(90, 90, 90))
    y += 30
    d.text((50, y), "This is a computer-generated demo invoice for the Saarthi / BharatOil OCR intake demo — not a real transaction.",
            font=f(F_REG, 12), fill=(160, 160, 160))

    path = os.path.join(OUT_DIR, filename)
    img.save(path, "PNG")
    print(f"[SAVED] {path}  ({len(items)} line items, total INR {total:,.2f})")


draw_bill(
    "bill_1_fastfix_fasteners.png",
    vendor="FastFix Industries",
    vendor_addr="Plot 22, GIDC Industrial Estate, Vatva, Ahmedabad, Gujarat 382445",
    gstin="27AABCF1234A1Z5",
    invoice_no="FFX/24-25/1187",
    date="10-Jul-2024",
    po_no="BOIL/PO/2024/0456",
    items=[
        ("Hexagonal Head Bolt M8x25mm Stainless Steel Grade 304 Full Thread ISO 4014", 1000, "EA", 11.50),
        ("Hexagonal Nut M8 Stainless Steel Grade 304 ISO 4032", 1000, "EA", 4.20),
        ("Plain Washer M8 Stainless Steel Grade 304 ISO 7089", 1000, "EA", 1.80),
        ("Stud Bolt M16x50mm ASTM A193 Grade B7 with 2H Heavy Hex Nuts", 200, "SET", 145.00),
        ("S.S Hexagonal Bolt 8mm Diameter 25mm Length Grade 304 Stainless", 500, "EA", 12.10),
    ],
)

draw_bill(
    "bill_2_electrocore_motors.png",
    vendor="ElectroCore Ltd",
    vendor_addr="B-14, Electronic City Phase 2, Bengaluru, Karnataka 560100",
    gstin="32AABCE3456D4Z8",
    invoice_no="ECL/INV/2024/0892",
    date="15-Aug-2024",
    po_no="BOIL/PO/2024/0521",
    items=[
        ("3 Phase Induction Motor 5HP 415V 50Hz 1450RPM IP55 TEFC Frame 132S", 3, "EA", 17800.00),
        ("Aluminium Armoured Cable 3 Core 4 Sqmm XLPE Insulated PVC Sheathed 1.1kV", 300, "MTR", 68.50),
        ("Copper Control Cable 2 Core 1 Sqmm PVC Insulated PVC Sheathed 1.1kV Screened", 150, "MTR", 42.00),
        ("Pressure Gauge 0-100 PSI 2.5 Inch Dial Stainless Steel Bourdon Tube Glycerine Filled", 12, "EA", 890.00),
        ("5 Horsepower 3-Phase Induction Motor 415 Volt 50 Hertz IP55", 2, "EA", 18200.00),
    ],
)

draw_bill(
    "bill_3_lubrimax_safegear.png",
    vendor="LubriMax India",
    vendor_addr="Survey No. 88, MIDC Taloja, Navi Mumbai, Maharashtra 410208",
    gstin="08AABCL7890E5Z6",
    invoice_no="LMX/24/3341",
    date="22-May-2024",
    po_no="BOIL/PO/2024/0398",
    items=[
        ("Hydraulic Oil ISO VG 68 20 Litre HDPE Drum Anti-Wear Mineral Based", 25, "EA", 1920.00),
        ("Lithium EP Grease NLGI Grade 2 1 Kg Tin Extreme Pressure Multi-Purpose", 80, "EA", 245.00),
        ("Safety Helmet HDPE Type 1 Class A IS 2925 with Ratchet Suspension Yellow", 150, "EA", 265.00),
        ("Safety Shoes Steel Toe Cap Size 8 IS 15298 Black Leather Upper Anti-Slip Sole", 60, "PR", 780.00),
        ("Welding Electrode E6013 General Purpose 3.2mm Dia 450mm Length 5Kg Pack", 150, "PKT", 620.00),
    ],
)

print("DONE")
