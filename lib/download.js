/**
 * Client-side helpers to export data as Excel (.xlsx) or PDF.
 * Both functions accept an array of plain objects and a filename stem.
 */

export async function downloadExcel(rows, filename) {
  const XLSX = (await import('xlsx')).default;
  const ws   = XLSX.utils.json_to_sheet(rows);
  const wb   = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  // Auto column widths
  const colWidths = Object.keys(rows[0] || {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2,
  }));
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function downloadPDF(columns, rows, filename, title) {
  const { default: jsPDF }    = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 40, 36);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 40, 52);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 64,
    head: [columns.map(c => c.header)],
    body: rows.map(row => columns.map(c => row[c.key] ?? '—')),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 247, 237] },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${filename}.pdf`);
}
