const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Function to generate invoice for all buyers
function generateAllBuyersInvoice(purchases, total_paid, total_unpaid, grand_total, invoiceNo) {
    const filePath = path.join(__dirname, 'invoices', `${invoiceNo}.pdf`);
    const doc = new PDFDocument({ margin: 50 });

    // Helper function to format numbers with commas (for amount fields)
    function formatWithCommas(value) {
        const numValue = Number(value);  // Convert value to a number
        if (isNaN(numValue)) {
            console.error('Invalid number value:', value); // Log invalid values
            return '0.00';
        }
        return numValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    try {
        // Header Section
        doc.rect(0, 0, doc.page.width, 70).fill('#1ab4f1').fillColor('#000');
        doc.image('./public/lsg.png', 50, 15, { width: 100 });
        doc.font('Helvetica-Bold')
            .fillColor('#FFFFFF')
            .fontSize(16)
            .text('Invoice for All Buyers', doc.page.width - 300, 30, { align: 'right' });
        doc.moveDown(2);

        const dateString = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.fontSize(8).fillColor('#000');
        doc.font('Helvetica-Bold').text('INVOICE NO:', doc.page.width - 200, 90, { align: 'right' });
        doc.font('Helvetica').text(invoiceNo, doc.page.width - 250, 105, { align: 'right' });
        doc.font('Helvetica-Bold').text('DATE:', doc.page.width - 250, 120, { align: 'right' });
        doc.font('Helvetica').text(dateString, doc.page.width - 250, 135, { align: 'right' });

        // Table Header
        const tableTop = 160;
        const headers = [
            { label: 'SL', x: 55, width: 20, align: 'left' },
            { label: 'Party Name', x: 75, width: 90, align: 'left' },
            { label: 'Container No', x: 130, width: 80, align: 'left' },
            { label: 'Weight Sold (KG)', x: 200, width: 80, align: 'left' },
            { label: 'Price Per KG', x: 270, width: 80, align: 'left' },
            { label: 'Purchase Date', x: 330, width: 60, align: 'left' },
            { label: 'Paid Amount', x: 390, width: 60, align: 'left' },
            { label: 'Unpaid Amount', x: 450, width: 80, align: 'left' },
            { label: 'Total Price', x: 500, width: 60, align: 'right' },
        ];

        doc.fillColor('#FFF').rect(50, tableTop, doc.page.width - 100, 20).fill('#333').stroke();
        doc.fontSize(7).fillColor('#FFF');
        headers.forEach(({ label, x, width, align }) => {
            doc.text(label, x, tableTop + 5, { width, align });
        });

        // Add Purchase Rows
        doc.fontSize(7).fillColor('#000');
        let currentY = tableTop + 25;
        let totalPaid = 0;  // Initialize totalPaid
        let totalUnpaid = 0;  // Initialize totalUnpaid
        let grandTotal = 0;  // Initialize grandTotal

        purchases.forEach((purchase, index) => {

            // Use the values directly without formatting for weight_sold and price_per_kg
            const weightSold = purchase.weight_sold || '0.00';
            const pricePerKg = purchase.price_per_kg || '0.00';

            // Add to totals
            totalPaid += purchase.paid_amount || 0;
            totalUnpaid += purchase.unpaid_amount || 0;
            grandTotal += purchase.total_price || 0;

            doc.text(index + 1, 55, currentY, { width: 20, align: 'left' });
            doc.text(purchase.buyer_name || 'N/A', 75, currentY, { width: 90, align: 'left' });
            doc.text(purchase.container_number || 'N/A', 130, currentY, { width: 80, align: 'left' });
            doc.text(weightSold, 170, currentY, { width: 80, align: 'right' });
            doc.text(pricePerKg, 230, currentY, { width: 80, align: 'right' });
            doc.text(purchase.purchase_date || 'N/A', 330, currentY, { width: 60, align: 'left' });

            // Format only the amount fields with commas
            doc.text(formatWithCommas(purchase.paid_amount || '0.00'), 370, currentY, { width: 60, align: 'right' });
            doc.text(formatWithCommas(purchase.unpaid_amount || '0.00'), 420, currentY, { width: 80, align: 'right' });
            doc.text(formatWithCommas(purchase.total_price || '0.00'), 500, currentY, { width: 60, align: 'right' });

            currentY += 20;
        });

        // Add Totals Section
        doc.moveTo(50, currentY).lineTo(doc.page.width - 50, currentY).stroke();

        // Adjust positions for totals to display on the same line
        doc.fontSize(7.5).font('Helvetica-Bold')
            .text(` ${formatWithCommas(totalPaid)}`, doc.page.width - 230, currentY + 10, { align: 'left' })
            .text(` ${formatWithCommas(totalUnpaid)}`, doc.page.width - 165, currentY + 10, { align: 'left' })
            .text(` ${formatWithCommas(grandTotal)}`, doc.page.width - 105, currentY + 10, { align: 'left' });

        // Footer Section
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

module.exports = generateAllBuyersInvoice;  // Export the function
