import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import io

def export_to_excel(data, filename="report.xlsx"):
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Attendance')
    return output.getvalue()

def export_to_pdf(data, title="Attendance Report"):
    output = io.BytesIO()
    p = canvas.Canvas(output, pagesize=letter)
    p.drawString(100, 750, title)
    
    y = 700
    for row in data:
        line = " | ".join([f"{k}: {v}" for k, v in row.items()])
        p.drawString(100, y, line)
        y -= 20
        if y < 50:
            p.showPage()
            y = 750
            
    p.save()
    return output.getvalue()
