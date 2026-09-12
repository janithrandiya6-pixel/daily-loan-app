const PDFDocument = require('pdfkit');

function generateReceiptPDF(res, paymentData) {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=receipt-${paymentData.id}.pdf`);
  
  doc.pipe(res);
  doc.fontSize(20).text('PAYCONTROL - PAYMENT RECEIPT', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Receipt ID: #${paymentData.id}`);
  doc.text(`Customer: ${paymentData.customer_name}`);
  doc.text(`Date: ${paymentData.date}`);
  doc.text(`Amount Paid: Rs. ${paymentData.amount_paid}`);
  doc.moveDown();
  doc.text('Thank you!', { align: 'center' });
  doc.end();
}

module.exports = { generateReceiptPDF };