import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ReceiptData {
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  shopLogoUrl?: string;
  receiptId: string;
  date: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  totalAmount: number;
  amountPaid: number;
  paymentType: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  staffName?: string;
  currency: string;
  footer?: string;
}

// A5 landscape = 210mm x 148mm, half = one receipt slot of 105mm x 148mm
// We produce one receipt at 148mm x 105mm (landscape A5) so two fit on A4
export function generateReceiptPDF(data: ReceiptData): jsPDF {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a5", // 210 x 148 mm landscape -> receipt area
  });

  const pageWidth = doc.internal.pageSize.getWidth();  // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 148

  // ── Green & Yellow border ──
  const borderOuter = 3;
  const borderInner = 1.5;
  // Outer green border
  doc.setDrawColor(34, 139, 34); // forest green
  doc.setLineWidth(borderOuter);
  doc.rect(borderOuter / 2, borderOuter / 2, pageWidth - borderOuter, pageHeight - borderOuter);
  // Inner yellow border
  doc.setDrawColor(255, 200, 0); // golden yellow
  doc.setLineWidth(borderInner);
  const offset = 5;
  doc.rect(offset, offset, pageWidth - offset * 2, pageHeight - offset * 2);

  // Content starts inside border
  const margin = 9;
  let y = margin + 4;
  const contentWidth = pageWidth - margin * 2;

  const GREEN: [number, number, number] = [22, 101, 52];

  // Logo (if provided, we'll use a placeholder box since loading image is async)
  // For now print shop name header prominently
  // ── Shop Name ──
  doc.setTextColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(data.shopName.toUpperCase(), pageWidth / 2, y, { align: "center" });
  y += 7;

  // Shop details
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  if (data.shopAddress) {
    doc.text(data.shopAddress, pageWidth / 2, y, { align: "center" });
    y += 5;
  }
  if (data.shopPhone) {
    doc.text(`Tel: ${data.shopPhone}`, pageWidth / 2, y, { align: "center" });
    y += 5;
  }

  // ── Horizontal rule (green) ──
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // ── Receipt info (two-column layout) ──
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GREEN);

  const col1x = margin;
  const col2x = pageWidth / 2 + 2;

  doc.text(`Receipt: ${data.receiptId}`, col1x, y);
  doc.text(`Date: ${data.date}`, col2x, y);
  y += 5;

  if (data.customerName) {
    doc.text(`Customer: ${data.customerName}`, col1x, y);
    if (data.customerPhone) doc.text(`Phone: ${data.customerPhone}`, col2x, y);
    y += 5;
  }
  if (data.customerAddress) {
    doc.text(`Address: ${data.customerAddress}`, col1x, y);
    y += 5;
  }
  if (data.staffName) {
    doc.text(`Served by: ${data.staffName}`, col1x, y);
    y += 5;
  }

  // ── Divider ──
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 3;

  // ── Items table ──
  const tableData = data.items.map((item) => [
    item.name,
    item.quantity.toString(),
    `${data.currency} ${item.unitPrice.toLocaleString()}`,
    `${data.currency} ${item.total.toLocaleString()}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Item", "Qty", "Unit Price", "Total"]],
    body: tableData,
    theme: "plain",
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      fontStyle: "bold",
      textColor: GREEN,
    },
    headStyles: {
      fontStyle: "bold",
      textColor: GREEN,
      lineColor: GREEN,
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 14, halign: "center" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
    },
    margin: { left: margin, right: margin },
    tableLineColor: GREEN,
    tableLineWidth: 0.2,
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;

  // ── Divider ──
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // ── Totals ──
  doc.setTextColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`TOTAL: ${data.currency} ${data.totalAmount.toLocaleString()}`, pageWidth - margin, y, { align: "right" });
  y += 5;

  doc.setFontSize(9);
  doc.text(`Paid: ${data.currency} ${data.amountPaid.toLocaleString()}`, pageWidth - margin, y, { align: "right" });
  y += 4;
  doc.text(`Payment: ${data.paymentType.toUpperCase()}`, pageWidth - margin, y, { align: "right" });
  y += 4;

  const change = data.amountPaid - data.totalAmount;
  if (change > 0) {
    doc.text(`Change: ${data.currency} ${change.toLocaleString()}`, pageWidth - margin, y, { align: "right" });
    y += 4;
  } else if (change < 0) {
    doc.setFontSize(10);
    doc.text(`BALANCE DUE: ${data.currency} ${Math.abs(change).toLocaleString()}`, pageWidth - margin, y, { align: "right" });
    y += 5;
  }

  // ── Footer ──
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const footer = data.footer || "Thank you for shopping with us!";
  doc.text(footer, pageWidth / 2, y, { align: "center" });

  return doc;
}

interface DailyReportData {
  shopName: string;
  reportDate: string;
  generatedAt: string;
  currency: string;
  summary: {
    totalSales: number;
    cashSales: number;
    creditSales: number;
    transactionCount: number;
    averageTransaction: number;
    totalProfit: number;
  };
  salesByHour: { hour: string; amount: number; count: number }[];
  topProducts: { name: string; quantity: number; revenue: number; profit: number }[];
  staffPerformance: { name: string; sales: number; transactions: number }[];
  outstandingLoans: { customerName: string; amount: number }[];
  topCustomers: { name: string; totalSpent: number; transactions: number }[];
}

export function generateDailyReportPDF(data: DailyReportData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const GREEN: [number, number, number] = [22, 101, 52];
  let y = 15;

  doc.setTextColor(...GREEN);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(data.shopName, pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(14);
  doc.text("Daily Sales Report", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Date: ${data.reportDate}`, pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.text(`Generated: ${data.generatedAt}`, pageWidth / 2, y, { align: "center" });
  y += 10;

  // Summary section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Sales Summary", 14, y);
  y += 6;

  const summaryData = [
    ["Total Sales", `${data.currency} ${data.summary.totalSales.toLocaleString()}`],
    ["Total Profit", `${data.currency} ${data.summary.totalProfit.toLocaleString()}`],
    ["Cash Sales", `${data.currency} ${data.summary.cashSales.toLocaleString()}`],
    ["Credit Sales", `${data.currency} ${data.summary.creditSales.toLocaleString()}`],
    ["Transactions", data.summary.transactionCount.toString()],
    ["Average Sale", `${data.currency} ${Math.round(data.summary.averageTransaction).toLocaleString()}`],
  ];

  autoTable(doc, {
    startY: y,
    body: summaryData,
    theme: "grid",
    styles: { fontSize: 10, fontStyle: "bold", textColor: GREEN },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
      1: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Top Products
  if (data.topProducts.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GREEN);
    doc.text("Top Products", 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Product", "Qty Sold", "Revenue", "Profit"]],
      body: data.topProducts.map((p) => [
        p.name,
        p.quantity.toString(),
        `${data.currency} ${p.revenue.toLocaleString()}`,
        `${data.currency} ${p.profit.toLocaleString()}`,
      ]),
      theme: "striped",
      styles: { fontSize: 9, fontStyle: "bold", textColor: GREEN },
      headStyles: { fillColor: GREEN, textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Top Customers
  if (data.topCustomers && data.topCustomers.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GREEN);
    doc.text("Top Customers", 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Customer", "Total Spent", "Transactions"]],
      body: data.topCustomers.map((c) => [
        c.name,
        `${data.currency} ${c.totalSpent.toLocaleString()}`,
        c.transactions.toString(),
      ]),
      theme: "striped",
      styles: { fontSize: 9, fontStyle: "bold", textColor: GREEN },
      headStyles: { fillColor: GREEN, textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Staff Performance
  if (data.staffPerformance.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GREEN);
    doc.text("Staff Performance", 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Staff", "Sales", "Transactions"]],
      body: data.staffPerformance.map((s) => [
        s.name,
        `${data.currency} ${s.sales.toLocaleString()}`,
        s.transactions.toString(),
      ]),
      theme: "striped",
      styles: { fontSize: 9, fontStyle: "bold", textColor: GREEN },
      headStyles: { fillColor: [70, 130, 180], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Outstanding Loans
  if (data.outstandingLoans.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GREEN);
    doc.text("Outstanding Loans", 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Customer", "Amount Owed"]],
      body: data.outstandingLoans.map((l) => [
        l.customerName,
        `${data.currency} ${l.amount.toLocaleString()}`,
      ]),
      theme: "striped",
      styles: { fontSize: 9, fontStyle: "bold", textColor: GREEN },
      headStyles: { fillColor: [220, 53, 69], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 },
    });
  }

  // Page numbers
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(filename);
}

export function printPDF(doc: jsPDF) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url);
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}
