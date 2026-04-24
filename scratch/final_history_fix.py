import os

file_path = r'c:\Users\shhah\Desktop\My Projects\saudi-property-manager\components\History.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'categoryShort' in line and 'class="td-label"' in line:
        new_lines.append('                            <td class="td-label">الفئة<span class="en">{t(\'entry.categoryShort\')}</span></td>\n')
    else:
        new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
