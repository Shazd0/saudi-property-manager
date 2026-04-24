import os
import re

file_path = r'c:\Users\shhah\Desktop\My Projects\saudi-property-manager\components\History.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Patterns to match lines and replace them
replacements = [
    (r'Contract Period', '                            <td class="td-label">فترة العقد<span class="en">Contract Period</span></td>\n'),
    (r'Period</span></td>', '                            <td class="td-label">فترة القسط<span class="en">Installment #${(tx as any).installmentNumber || \'\'} Period</span></td>\n'),
    (r'Tax Breakdown /', '                          <div class="vat-title">Tax Breakdown / تفاصيل الضريبة</div>\n'),
    (r'Amount Excl. VAT /', '                          <div class="vat-row"><span class="vr-label">Amount Excl. VAT / المبلغ قبل الضريبة</span><span class="vr-val">${(tx.amountExcludingVAT || tx.amount).toLocaleString(\'en-US\', {minimumFractionDigits: 2})} SAR</span></div>\n'),
    (r'VAT 15% /', '                          <div class="vat-row"><span class="vr-label">VAT 15% / ضريبة القيمة المضافة</span><span class="vr-val">${tx.vatAmount.toLocaleString(\'en-US\', {minimumFractionDigits: 2})} SAR</span></div>\n'),
    (r'Total /', '                          <div class="vat-row total"><span class="vr-label">Total / الإجمالي</span><span class="vr-val">${tx.amount.toLocaleString(\'en-US\', {minimumFractionDigits: 2})} SAR</span></div>\n'),
    (r"sellerName = '", "        const sellerName = 'شركة ارار ميلينيوم المحدودة';\n")
]

new_lines = []
for line in lines:
    fixed = False
    # Only replace lines within the handlePrintReceipt area or buildZATCAQR
    if 'class="td-label"' in line or 'class="vr-label"' in line or 'class="vat-title"' in line or 'sellerName =' in line:
        for pattern, replacement in replacements:
            if pattern in line:
                new_lines.append(replacement)
                fixed = True
                break
    if not fixed:
        new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Fixed History.tsx using line-by-line English pattern matching.")
