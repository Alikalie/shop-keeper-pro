import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ReceiptData {
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
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
  staffName?: string;
  currency: string;
  footer?: string;
}

export function generateReceiptPDF(data: ReceiptData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, 200], // Receipt width
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 10;

  // Shop name
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.shopName, pageWidth / 2, y, { align: "center" });
  y += 6;

  // Shop details
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  if (data.shopAddress) {
    doc.text(data.shopAddress, pageWidth / 2, y, { align: "center" });
    y += 4;
  }
  if (data.shopPhone) {
    doc.text(`Tel: ${data.shopPhone}`, pageWidth / 2, y, { align: "center" });
    y += 4;
  }

  // Divider
  y += 2;
  doc.setLineWidth(0.3);
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  // Receipt info
  doc.setFontSize(9);
  doc.text(`Receipt: ${data.receiptId}`, 5, y);
  y += 4;
  doc.text(`Date: ${data.date}`, 5, y);
  y += 4;
  if (data.customerName) {
    doc.text(`Customer: ${data.customerName}`, 5, y);
    y += 4;
  }
  if (data.staffName) {
    doc.text(`Served by: ${data.staffName}`, 5, y);
    y += 4;
  }

  // Divider
  y += 2;
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  // Items table
  const tableData = data.items.map((item) => [
    item.name,
    item.quantity.toString(),
    `${data.currency} ${item.unitPrice.toLocaleString()}`,
    `${data.currency} ${item.total.toLocaleString()}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Item", "Qty", "Price", "Total"]],
    body: tableData,
    theme: "plain",
    styles: {
      fontSize: 8,
      cellPadding: 1,
    },
    headStyles: {
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 10, halign: "center" },
      2: { cellWidth: 18, halign: "right" },
      3: { cellWidth: 18, halign: "right" },
    },
    margin: { left: 5, right: 5 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  // Divider
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  // Totals
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL: ${data.currency} ${data.totalAmount.toLocaleString()}`, pageWidth - 5, y, { align: "right" });
  y += 5;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Paid: ${data.currency} ${data.amountPaid.toLocaleString()}`, pageWidth - 5, y, { align: "right" });
  y += 4;
  doc.text(`Payment: ${data.paymentType}`, pageWidth - 5, y, { align: "right" });
  y += 4;

  const change = data.amountPaid - data.totalAmount;
  if (change > 0) {
    doc.text(`Change: ${data.currency} ${change.toLocaleString()}`, pageWidth - 5, y, { align: "right" });
    y += 4;
  } else if (change < 0) {
    doc.text(`Balance: ${data.currency} ${Math.abs(change).toLocaleString()}`, pageWidth - 5, y, { align: "right" });
    y += 4;
  }

  // Footer
  y += 4;
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
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
  };
  salesByHour: { hour: string; amount: number; count: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  staffPerformance: { name: string; sales: number; transactions: number }[];
  outstandingLoans: { customerName: string; amount: number }[];
}

export function generateDailyReportPDF(data: DailyReportData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(data.shopName, pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(14);
  doc.text("Daily Sales Report", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${data.reportDate}`, pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.text(`Generated: ${data.generatedAt}`, pageWidth / 2, y, { align: "center" });
  y += 10;

  // Summary section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Sales Summary", 14, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  const summaryData = [
    ["Total Sales", `${data.currency} ${data.summary.totalSales.toLocaleString()}`],
    ["Cash Sales", `${data.currency} ${data.summary.cashSales.toLocaleString()}`],
    ["Credit Sales", `${data.currency} ${data.summary.creditSales.toLocaleString()}`],
    ["Transactions", data.summary.transactionCount.toString()],
    ["Average Sale", `${data.currency} ${data.summary.averageTransaction.toLocaleString()}`],
  ];

  autoTable(doc, {
    startY: y,
    body: summaryData,
    theme: "grid",
    styles: { fontSize: 10 },
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
    doc.text("Top Products", 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Product", "Qty Sold", "Revenue"]],
      body: data.topProducts.map((p) => [
        p.name,
        p.quantity.toString(),
        `${data.currency} ${p.revenue.toLocaleString()}`,
      ]),
      theme: "striped",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [34, 139, 34] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Staff Performance
  if (data.staffPerformance.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
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
      styles: { fontSize: 9 },
      headStyles: { fillColor: [70, 130, 180] },
      margin: { left: 14, right: 14 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Outstanding Loans
  if (data.outstandingLoans.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
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
      styles: { fontSize: 9 },
      headStyles: { fillColor: [220, 53, 69] },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
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
