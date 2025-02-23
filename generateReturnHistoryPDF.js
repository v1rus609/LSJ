const fs = require('fs');
const PDFDocument = require('pdfkit');
const path = require('path');

function generateReturnHistoryPDF(returns, totalAmount, buyerName, buyerDetails) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const filePath = path.join(__dirname, 'exports', `Return_History_${Date.now()}.pdf`);

        doc.pipe(fs.createWriteStream(filePath));

        doc.fontSize(16).text(`Return History for ${buyerName}`, { align: 'center' });
        doc.moveDown(1);
        doc.fontSize(12).text(`Location: ${buyerDetails.location}`);
        doc.moveDown(2);

        // Table header
        doc.fontSize(10)
            .text('SL  Buyer Name  Container No  Return Date  Returned KG  Price per KG  Total Amount', { align: 'left' })
            .moveDown();

        // Table content
        returns.forEach((returnRecord, index) => {
            const { buyer_name, container_number, return_date, returned_kg, returned_price_per_kg, total_amount } = returnRecord;

            doc.text(`${index + 1}  ${buyer_name}  ${container_number}  ${return_date}  ${returned_kg} kg  ${returned_price_per_kg} BDT  ${total_amount} BDT`);
        });

        // Total Amount row
        doc.moveDown(2);
        doc.fontSize(12).text(`Total Returned KG: ${totalAmount.totalReturnedKg} kg`, { align: 'left' });
        doc.text(`Total Amount: ${totalAmount.totalAmount} BDT`, { align: 'left' });

        doc.end();

        resolve(filePath); // Return the generated PDF file path
    });
}

module.exports = generateReturnHistoryPDF;
