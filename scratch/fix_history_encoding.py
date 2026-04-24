import os

file_path = r'c:\Users\shhah\Desktop\My Projects\saudi-property-manager\components\History.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix mangled Arabic strings
replacements = {
    'Ù\xa0ØªØ±Ø© Ø§Ù„Ø¹Ù\x82Ø¯': 'فترة العقد',
    'Ù\xa0ØªØ±Ø© Ø§Ù„Ù\x82Ø³Ø·': 'فترة القسط',
    'Ø§Ù„Ù\x81Ø¦Ø©': 'الفئة',
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed encoding issues in History.tsx")
