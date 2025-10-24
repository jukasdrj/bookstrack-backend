#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import random

# Create a test bookshelf image with book spines
width, height = 1200, 800
img = Image.new('RGB', (width, height), color='#F5E6D3')
draw = ImageDraw.Draw(img)

# Draw some book spines
books = [
    {"title": "1984", "author": "George Orwell", "color": "#8B4513", "x": 50, "width": 80},
    {"title": "To Kill a Mockingbird", "author": "Harper Lee", "color": "#4169E1", "x": 140, "width": 100},
    {"title": "The Great Gatsby", "author": "F. Scott Fitzgerald", "color": "#228B22", "x": 250, "width": 90},
    {"title": "Pride and Prejudice", "author": "Jane Austen", "color": "#DC143C", "x": 350, "width": 95},
    {"title": "The Catcher in the Rye", "author": "J.D. Salinger", "color": "#FF8C00", "x": 455, "width": 85},
]

# Draw book spines
for book in books:
    # Draw spine rectangle
    draw.rectangle([book["x"], 100, book["x"] + book["width"], 700], fill=book["color"])
    
    # Draw title (rotated text simulation - we'll just draw it vertically)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
    except:
        font = ImageFont.load_default()
    
    # Draw text on spine (simplified - no rotation)
    text_x = book["x"] + book["width"] // 2 - 5
    draw.text((text_x, 150), book["title"], fill='white', font=font)
    draw.text((text_x, 400), book["author"], fill='white', font=font)

# Save the image
img.save('test-bookshelf.jpg', 'JPEG', quality=85)
print("Created test-bookshelf.jpg")
