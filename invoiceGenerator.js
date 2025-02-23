const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path'); // Add this line to import the 'path' module

function generateInvoice({ buyer, purchases, total_paid }, invoiceNo) {
    const filePath = path.join(__dirname, 'invoices', `${invoiceNo}.pdf`);
    const doc = new PDFDocument({ margin: 50 });

    // Helper function to format numbers with commas
    function formatWithCommas(value) {
        return parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Stream the PDF to file
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    try {
        // Header Section
        doc.rect(0, 0, doc.page.width, 70).fill('#1ab4f1').fillColor('#000');
        doc.image('./public/lsg.png', 50, 15, { width: 100 });
        doc.font('Helvetica-Bold')
            .fillColor('#FFFFFF')
            .fontSize(16)
            .text('Invoice', doc.page.width - 300, 30, { align: 'right' });
        doc.moveDown(2);

        // Buyer and Invoice Details
        const dateString = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.fontSize(9).fillColor('#000');
        doc.font('Helvetica-Bold').text('INVOICE TO:', 50, 90);
        doc.font('Helvetica').text(buyer.name, 50, 105);
        doc.text(buyer.location, 50, 120);

		doc.font('Helvetica-Bold').text('INVOICE NO:', doc.page.width - 200, 90, { align: 'right' });
        doc.font('Helvetica').text(invoiceNo, doc.page.width - 250, 105, { align: 'right' });
        doc.font('Helvetica-Bold').text('DATE:', doc.page.width - 250, 120, { align: 'right' });
        doc.font('Helvetica').text(dateString, doc.page.width - 250, 135, { align: 'right' });

        // Table Header
        const tableTop = 160;
const headers = [
    { label: 'SL', x: 55, width: 20, align: 'left' },
    { label: 'Container No', x: 80, width: 60, align: 'left' },
    { label: 'Weight Sold (KG)', x: 165, width: 80, align: 'left' },
    { label: 'Price Per KG', x: 240, width: 80, align: 'left' },
    { label: 'Purchase Date', x: 300, width: 60, align: 'left' },
    { label: 'Paid Amount', x: 360, width: 60, align: 'left' },
    { label: 'Unpaid Amount', x: 435, width: 80, align: 'left' },
    { label: 'Total Price', x: 500, width: 60, align: 'right' },
];

        doc.fillColor('#FFF').rect(50, tableTop, doc.page.width - 100, 20).fill('#333').stroke();
        doc.fontSize(8).fillColor('#FFF');
        headers.forEach(({ label, x, width, align }) => {
            doc.text(label, x, tableTop + 5, { width, align });
        });

        // Add Purchase Rows
        doc.fontSize(8).fillColor('#000');
        let currentY = tableTop + 25;
        let totalUnpaid = 0;
        let grandTotal = 0;

purchases.forEach((purchase, index) => {
    const { container_number, weight_sold, price_per_kg, purchase_date, paid_amount, unpaid_amount, total_price } = purchase;

    doc.text(index + 1, 55, currentY, { width: 20, align: 'left' });
    doc.text(container_number || 'N/A', 80, currentY, { width: 100, align: 'left' });
    doc.text(formatWithCommas(weight_sold || 0), 165, currentY, { width: 80, align: 'left' });
    doc.text(formatWithCommas(price_per_kg || 0), 240, currentY, { width: 80, align: 'left' });
    doc.text(purchase_date || 'N/A', 300, currentY, { width: 100, align: 'left' });
    doc.text(formatWithCommas(paid_amount || 0), 305, currentY, { width: 100, align: 'right' });
    doc.text(formatWithCommas(unpaid_amount || 0), 390, currentY, { width: 100, align: 'right' });
    doc.text(formatWithCommas(total_price || 0), 460, currentY, { width: 100, align: 'right' });

    // ✅ Update totals correctly
    totalUnpaid += parseFloat(unpaid_amount) || 0;
    grandTotal += parseFloat(total_price) || 0;

    currentY += 20;
});



        // Add Totals Section
        doc.moveTo(50, currentY).lineTo(doc.page.width - 50, currentY).stroke();

        doc.fontSize(9).font('Helvetica-Bold').text(`${formatWithCommas(total_paid)}`, doc.page.width - 260, currentY + 10, { align: 'left' });
        doc.text(`${formatWithCommas(totalUnpaid)}`, doc.page.width - 180, currentY + 10, { align: 'left' });
        doc.text(`${formatWithCommas(grandTotal)}`, doc.page.width - 110, currentY + 10, { align: 'left' });

        // Footer Section
        doc.moveDown(2).fontSize(8).fillColor('#000').font('Helvetica-Bold').text('Payment Details', 50, currentY + 70, { underline: true });
        doc.font('Helvetica').text('Account Name: TechGarlic Limited', 50, currentY + 85);
        doc.text('Account No: 1223420043001', 50, currentY + 100);
        doc.text('Branch: Mouchak Branch', 50, currentY + 115);
        doc.text('Bank: The City Bank Limited', 50, currentY + 130);
        doc.text('Routing No: 225274361', 50, currentY + 145);

         // Footer Section: Centered and positioned at the bottom
        const footerY = doc.page.height - 50;
        doc.fontSize(12).font('Helvetica-Bold').text('Thank You For Your Business', 50, footerY - 100, { align: 'center' });
        doc.fontSize(10).font('Helvetica').text('Generated by bYTE Digital.', 50, footerY - 30, { align: 'center' });
        doc.text('For inquiries, contact info@lsgroupbd.com', 50, footerY - 15, { align: 'center' });
    } catch (error) {
        console.error('Error generating PDF:', error);
    }

    // Finalize and close the PDF
    doc.end();

    return new Promise((resolve, reject) => {
        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
    });
}

module.exports = generateInvoice;
