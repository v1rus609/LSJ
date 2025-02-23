const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

function generatePaymentHistoryPDF(payments, totalReceived, selectedBuyer, buyerDetails) {
    const filePath = path.join(__dirname, 'exports', `Payment_History_${Date.now()}.pdf`);
    const doc = new PDFDocument({ margin: 50 });

    // Helper function to format numbers with commas
    function formatNumberWithCommas(number) {
        return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Create a writable stream for the PDF
    let stream;
    try {
        stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Generate Invoice Details
        const invoiceNo = `INV-${Date.now()}`;
        const currentDate = new Date().toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        // Header Section
        doc.rect(0, 0, doc.page.width, 70).fill('#1ab4f1').fillColor('#000');
        doc.image('./public/lsg.png', 50, 15, { width: 100 });
        doc.font('Helvetica-Bold')
            .fillColor('#FFFFFF')
            .fontSize(16)
            .text('RECEIPT', doc.page.width - 200, 30, { align: 'right' });
        doc.moveDown(2);

        // INVOICE TO Section
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#000'); // Bold font for headers
        doc.text('INVOICE TO:', 50, 90);

        if (selectedBuyer === 'all') {
            doc.font('Helvetica').fontSize(10); // Regular font for content
            doc.text('All Buyers', 50, 110);
            doc.text('', 50, 120);
        } else {
            doc.font('Helvetica').fontSize(10); // Consistent font size for the content
            doc.text(buyerDetails.name || 'N/A', 50, 110); // Adjust position (x: 70, y: 100)
            doc.text(buyerDetails.location || 'N/A', 50, 130); // Adjust position (x: 70, y: 120)
        }

        // Invoice Details
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000'); // Set consistent font size for details
        doc.text('INVOICE NO:', 465, 90);
        doc.font('Helvetica').fontSize(10);
        doc.text(invoiceNo, 465, 100);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');
        doc.text('DATE:', 465, 120);
        doc.font('Helvetica').fontSize(10);
        doc.text(currentDate, 465, 130);

        // Table Header
        const columnWidths = [80, 70, 100, 80, 80, 95];
        const headers = ['Name of Party', 'Date', 'Particulars', 'Bank', 'Cash', 'Total'];
        const tableTop = 170;
        doc.rect(50, tableTop, doc.page.width - 100, 20).fill('#000').stroke().fillColor('#FFF');
        let startX = 50;
        doc.fontSize(10);
        headers.forEach((header, index) => {
            doc.text(header, startX, tableTop + 5, { width: columnWidths[index], align: 'right' });
            startX += columnWidths[index];
        });

        // Table Rows
        let currentY = tableTop + 25;
        doc.fontSize(10);
        payments.forEach((payment, index) => {
            const buyerName = payment.buyer_name || 'N/A';
            const paymentDate = payment.payment_date || 'N/A';
            const particulars = payment.particulars || 'N/A';
            const bankAmount = payment.bank_amount || 0.0;
            const cashAmount = payment.cash_amount || 0.0;
            const total = bankAmount + cashAmount;

            startX = 50;

            // Alternate Row Background
            if (index % 2 === 0) {
                doc.rect(50, currentY - 5, doc.page.width - 100, 20).fill('#F4F4F4').stroke().fillColor('#000');
            }

            // Populate each column
            doc.text(buyerName, startX, currentY, { width: columnWidths[0], align: 'right' });
            startX += columnWidths[0];
            doc.text(paymentDate, startX, currentY, { width: columnWidths[1], align: 'right' });
            startX += columnWidths[1];
            doc.text(particulars, startX, currentY, { width: columnWidths[2], align: 'right' });
            startX += columnWidths[2];
            doc.text(formatNumberWithCommas(bankAmount), startX, currentY, { width: columnWidths[3], align: 'right' });
            startX += columnWidths[3];
            doc.text(formatNumberWithCommas(cashAmount), startX, currentY, { width: columnWidths[4], align: 'right' });
            startX += columnWidths[4];
            doc.text(formatNumberWithCommas(total), startX, currentY, { width: columnWidths[5], align: 'right' });

            currentY += 20;
        });

        // Draw a line above the total
        doc.moveTo(50, currentY)
            .lineTo(68 + columnWidths.reduce((sum, width) => sum + width, 0), currentY)
            .stroke();

        // Total Received
        currentY += 10;
        doc.fontSize(10).font('Helvetica-Bold').text(`Total Received: ${formatNumberWithCommas(totalReceived)}`, 420, currentY, { align: 'center' });

        // Footer Section
        const footerY = doc.page.height - 50; // 50 units from the bottom
        doc.fontSize(12).font('Helvetica-Bold').text('Thank You For Your Business', 50, footerY - 100, { align: 'center' });
        doc.fontSize(10).font('Helvetica').text('Generated by bYTE Ltd.', 50, footerY - 30, { align: 'center' });
        doc.text('For inquiries, contact support@lsgroup.com.bd', 50, footerY - 15, { align: 'center' });

    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    } finally {
        if (stream) {
            doc.end();
        }
    }

    return new Promise((resolve, reject) => {
        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
    });
}

module.exports = generatePaymentHistoryPDF;
