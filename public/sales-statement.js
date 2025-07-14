let containerData = []; // Store fetched container data for filtering

// Helper functions for formatting numbers
function formatNumberWithCommas(value) {
    return !isNaN(value) && value !== '' ? parseFloat(value).toLocaleString('en-US') : value;
}

function getRawNumber(value) {
    return parseFloat(value.toString().replace(/,/g, '')) || 0;
}

// Fetch buyers to populate the dropdown
function fetchBuyers() {
fetch('/buyers/list')
    .then(response => response.json())
    .then(data => {
        const buyerFilter = document.getElementById('buyer-filter');
        buyerFilter.innerHTML = '<option value="all" data-id="0">All Buyers</option>'; // Default option

        data.forEach(buyer => {
            const option = document.createElement('option');
            option.value = buyer.name;
            option.textContent = buyer.name;
            option.setAttribute('data-id', buyer.id); // Store buyer ID in option
            buyerFilter.appendChild(option);
        });
    })
    .catch(error => console.error('Error fetching buyers:', error));

}

// Buyer search box functionality
document.getElementById('buyer-search-box').addEventListener('input', function () {
    const searchValue = this.value.toLowerCase();
    const buyerFilter = document.getElementById('buyer-filter');
    const options = buyerFilter.getElementsByTagName('option');

    // Loop through the options and hide those that don't match the search value
    Array.from(options).forEach(option => {
        const optionText = option.text.toLowerCase();
        if (optionText.includes(searchValue)) {
            option.style.display = '';
        } else {
            option.style.display = 'none';
        }
    });

});

// Fetch sales statement and purchase return data with filtering (without date filter)
function fetchSalesAndReturns(buyerName = 'all') {
    fetch('/buyers/list') // ✅ Fetch buyers first
        .then(response => response.json())
        .then(buyersData => {
            console.log('✅ Buyers Data:', buyersData); // Debugging

            // ✅ Append filters to API request (removed date filters)
            let query = `/sales/statement?buyer_name=${buyerName}`;

            fetch(query)
                .then(response => response.json())
                .then(salesData => {
                    console.log('✅ Sales Data:', salesData); // Debugging

                    fetch('/purchase-return/list')
                        .then(response => response.json())
                        .then(purchaseReturnsData => {
                            console.log('✅ Purchase Returns Data:', purchaseReturnsData); // Debugging

                            updateSalesTable(salesData, purchaseReturnsData, buyersData); // ✅ Pass buyersData
                        })
                        .catch(error => console.error('❌ Error fetching purchase return data:', error));
                })
                .catch(error => console.error('❌ Error fetching sales statement:', error));
        })
        .catch(error => console.error('❌ Error fetching buyers:', error));
}

// ✅ Update Sales Table Dynamically
function updateSalesTable(salesData, purchaseReturnsData, buyersData) {
    const tableBody = document.getElementById('sales-statement-table').querySelector('tbody');
    tableBody.innerHTML = ''; // Clear previous rows

    let totalPurchase = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let totalAdvanceReceipt = 0; // For Advance Receipt (Negative Opening Balance)

    // Keep track of the serial number
    let serialNumber = 1;

    const buyerIdMap = {};
    buyersData.forEach(buyer => {
        buyerIdMap[buyer.name] = buyer.id;
    });

    salesData.forEach((record) => {
        const buyerName = record.buyer_name || 'N/A';
        const totalPurchaseOriginal = record.total_purchase || 0;
        const totalPaidAmount = record.total_paid || 0;
        const totalUnpaidAmount = record.total_unpaid || 0;
        const buyerId = buyerIdMap[buyerName];

        if (!buyerId) {
            console.warn(`⚠ No matching buyer_id found for ${buyerName}`);
            return;
        }

        // Calculate Purchase Returns for this buyer
        const buyerReturns = purchaseReturnsData
            .filter(returnData => returnData.buyer_id == buyerId)
            .reduce((sum, returnItem) => sum + (returnItem.total_amount || 0), 0);

        fetch(`/buyers/opening-balance/${buyerId}`)
            .then(response => response.json())
            .then(openingBalanceData => {
                const openingBalance = openingBalanceData.opening_balance || 0;

                const positiveOpeningBalance = Math.max(0, openingBalance); 
                const negativeOpeningBalance = Math.min(0, openingBalance); 

                const adjustedPurchaseAmount = totalPurchaseOriginal - buyerReturns;
                const adjustedPurchaseWithOpeningBalance = adjustedPurchaseAmount + positiveOpeningBalance;
                const adjustedBalance = adjustedPurchaseWithOpeningBalance - totalPaidAmount + negativeOpeningBalance;

                totalPurchase += adjustedPurchaseWithOpeningBalance;
                totalPaid += totalPaidAmount;
                totalUnpaid += adjustedBalance;
                totalAdvanceReceipt += negativeOpeningBalance;

                // Create Row with Correct Serial Number
                const row = `
                    <tr>
                        <td>${serialNumber++}</td> <!-- Increment serial number for each row -->
                        <td>${buyerName}</td>
                        <td>${formatNumberWithCommas(adjustedPurchaseWithOpeningBalance)}</td>
                        <td>${formatNumberWithCommas(negativeOpeningBalance)}</td>
                        <td>${formatNumberWithCommas(totalPaidAmount)}</td>
                        <td>${formatNumberWithCommas(adjustedBalance)}</td>
                    </tr>
                `;
                tableBody.innerHTML += row;

                // Update Footer Totals
                document.getElementById('sum-total-purchase').textContent = formatNumberWithCommas(totalPurchase);
                document.getElementById('sum-total-advance-receipt').textContent = formatNumberWithCommas(totalAdvanceReceipt);
                document.getElementById('sum-total-paid').textContent = formatNumberWithCommas(totalPaid);
                document.getElementById('sum-total-unpaid').textContent = formatNumberWithCommas(totalUnpaid);
            })
            .catch(error => console.error('❌ Error fetching opening balance for buyer:', error));
    });
}

function renderTable(buyerData) {
    const tableBody = document.getElementById('sales-statement-table').querySelector('tbody');
    tableBody.innerHTML = ''; // Clear any previous rows

    // Loop through buyerData and create a row for each buyer
    buyerData.forEach((buyer, index) => {
        const row = `
            <tr>
                <td>${index + 1}</td>
                <td>${buyer.name}</td>
                <td>${buyer.amount}</td>
                <td>${buyer.advanceReceipt}</td>
                <td>${buyer.receipt}</td>
                <td>${buyer.balance}</td>
            </tr>
        `;
        tableBody.innerHTML += row; // Add the row to the table body
    });
}

// ✅ Function to Fetch and Update Balance Table
function fetchSalesAndBalanceUpdates() {
    fetch('/buyers/list')
        .then(response => response.json())
        .then(buyersData => {
            fetch('/sales/statement')
                .then(response => response.json())
                .then(salesData => {
                    fetch('/purchase-return/list')
                        .then(response => response.json())
                        .then(purchaseReturnsData => {
                            updateBalanceTable(salesData, purchaseReturnsData, buyersData);
                        })
                        .catch(error => console.error('❌ Error fetching purchase return data:', error));
                })
                .catch(error => console.error('❌ Error fetching sales statement:', error));
        })
        .catch(error => console.error('❌ Error fetching buyers:', error));
}

// ✅ Add event listener for filters (without date filter)
document.getElementById('apply-filters').addEventListener('click', function () {
    const buyerName = document.getElementById('buyer-filter').value;
    
    console.log(`🔍 Applying filters: Buyer=${buyerName}`);
    
    fetchSalesAndReturns(buyerName); // ✅ Pass selected buyer filter
});

// Add event listener for export to Excel
document.getElementById('export-sales-statement').addEventListener('click', function () {
    const table = document.getElementById('sales-statement-table');
    const workbook = XLSX.utils.table_to_book(table, { sheet: "Sales Statement" });
    const fileName = `Sales_Statement_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
});

        // Function to export table to PDF
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Ensure buyer dropdown exists
    const buyerDropdown = document.getElementById('buyer-filter'); 
    const selectedBuyerId = buyerDropdown.options[buyerDropdown.selectedIndex]?.getAttribute('data-id') || "0"; // Get selected buyer's ID
    const buyerName = buyerDropdown.value === "all" ? "All Buyers" : buyerDropdown.value; // Ensure "All Buyers" is displayed

    // Replace spaces with underscores in the buyer's name, but keep "All_Buyers" for consistency
    const sanitizedBuyerName = buyerDropdown.value === "all" ? "All_Buyers" : buyerName.replace(/\s+/g, "_");

    // Get current date and time
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).replace(/\//g, "-"); // Convert to "DD-MM-YYYY"

    let formattedTime = currentDate.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    formattedTime = formattedTime.replace(/[:\s]/g, "-").toUpperCase(); // Convert time to uppercase "HH-MM-AM/PM"

    // **Generate filename without location**
    const fileName = `Sales_Statement_${sanitizedBuyerName}_${formattedDate}_${formattedTime}.pdf`;

    // Fetch Buyer Location if a specific buyer is selected and has an ID
    let buyerLocation = '';
    if (selectedBuyerId !== "0") { 
        fetch(`/buyers/location/${selectedBuyerId}`)
            .then(response => response.json())
            .then(data => {
                buyerLocation = data.location || ''; // Assign buyer's location if available
                generatePDF(doc, buyerName, buyerLocation, formattedDate, fileName);
            })
            .catch(error => {
                console.error('Error fetching buyer location:', error);
                generatePDF(doc, buyerName, buyerLocation, formattedDate, fileName);
            });
    } else {
        generatePDF(doc, buyerName, buyerLocation, formattedDate, fileName);
    }
}

function generatePDF(doc, buyerName, buyerLocation, formattedDate, fileName) {
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const headerBarHeight = 18;
    let startY = headerBarHeight + 30; // Default starting position for the first page

    // Add the watermark first (on top of everything, faint transparency)
    const watermarkPath = "/public/watermark.png"; // Use your actual watermark path
    const watermarkImg = new Image();
    watermarkImg.src = watermarkPath;

    watermarkImg.onload = function () {
        // Function to add Header, Footer, and Watermark to every page
        function addHeaderAndFooterAndWatermark(doc, pageNumber) {
            // --- Watermark (on every page) ---
            doc.setGState(new doc.GState({ opacity: 0.2 })); // Faint watermark
            const watermarkX = pageWidth / 4;
            const watermarkY = pageHeight / 3;
            const watermarkWidth = pageWidth / 2;
            const watermarkHeight = pageHeight / 4;

            // Add watermark image on top of everything (behind the content)
            doc.addImage(watermarkImg, 'PNG', watermarkX, watermarkY, watermarkWidth, watermarkHeight);
            doc.setGState(new doc.GState({ opacity: 1 })); // Reset opacity for normal content

            // --- Header ---
            doc.setFillColor(49, 178, 230);
            doc.rect(0, 0, pageWidth, headerBarHeight, 'F');
            doc.addImage('/public/lsg.png', 'PNG', 14, 5, 30, 10); // Add logo
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 255, 255);
            doc.text("Sales Statement", pageWidth - 50, 11); // Header title

            // --- INVOICE TO Section (Only on the first page) ---
            if (pageNumber === 1) {
                const invoiceYPosition = 30;
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                doc.setFont("helvetica", "bold");
                doc.text("INVOICE TO:", 14, invoiceYPosition);
                doc.setFont("helvetica", "normal");
                doc.text(buyerName, 14, invoiceYPosition + 5);

                if (buyerLocation) {
                    doc.text(buyerLocation, 14, invoiceYPosition + 10);
                }

                // --- Date Section ---
                const dateLabel = "DATE:";
                const dateText = `${formattedDate}`;
                const dateLabelWidth = doc.getTextWidth(dateLabel);
                const xPosition = pageWidth - dateLabelWidth - 40; // Right align
                doc.setFont("helvetica", "bold");
                doc.text(dateLabel, xPosition, invoiceYPosition);
                doc.setFont("helvetica", "normal");
                doc.text(dateText, xPosition, invoiceYPosition + 5);
            }

            // --- Footer Section (on every page) ---
            const line1 = "Thank You For Your Business";
            const line2 = "Generated by bYTE Ltd.";
            const line3 = "For inquiries, contact support@lsgroup.com.bd";

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0); // Footer text color

            const line1Width = doc.getTextWidth(line1);
            const line2Width = doc.getTextWidth(line2);
            const line3Width = doc.getTextWidth(line3);

            const xPosition1 = (pageWidth - line1Width) / 2.3;
            const xPosition2 = (pageWidth - line2Width) / 2;
            const xPosition3 = (pageWidth - line3Width) / 2;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text(line1, xPosition1, pageHeight - 30);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.text(line2, xPosition2, pageHeight - 20);
            doc.text(line3, xPosition3, pageHeight - 15);
        }

        // --- Table Section ---
        const table = document.getElementById('sales-statement-table');
        
        // Define options for jsPDF autoTable
        const options = {
            html: table,
            theme: 'grid',
            startY: startY,  // Start position for table content
            margin: { horizontal: 10, top: 20, bottom: 40 },
            headStyles: {
                fillColor: [0, 0, 0], // Black background for table header
                textColor: [255, 255, 255], // White text in header
                fontSize: 8,
                fontStyle: 'bold',
            },
            bodyStyles: {
                fontSize: 9,
                textColor: [0, 0, 0],
                fillColor: null, // No background for table cells
            },
            footStyles: {
                fillColor: [220, 220, 220],
                textColor: [0, 0, 0],
                fontSize: 10,
                fontStyle: 'bold',
            },
            pageBreak: 'auto', // Allow page breaks automatically
            showHead: 'everyPage', // Ensure header shows on every page
            didDrawPage: function (data) {
                // Adjust the startY for subsequent pages to create a gap between header and table
                if (data.pageNumber > 1) {
                    startY = data.cursor + 30; // Adjust cursor for subsequent pages
                }
                
                // Add watermark to each page
                addHeaderAndFooterAndWatermark(doc, data.pageNumber); // Add header, footer, and watermark to every page
            },
        };

        // Create the table with autoTable and handle page breaks
        doc.autoTable(options);

        // Save PDF with dynamic filename
        doc.save(fileName);
    };
}



document.addEventListener("DOMContentLoaded", function() {
    // Get the dropdown button and menu
    const dropdownButton = document.querySelector(".dropbtn");
    const dropdownContent = document.querySelector(".dropdown-content");

    // Toggle dropdown visibility when button is clicked
    dropdownButton.addEventListener("click", function(event) {
        // Prevent the event from bubbling up to the document
        event.stopPropagation();

        // Toggle the display of the dropdown
        dropdownContent.style.display = dropdownContent.style.display === "block" ? "none" : "block";
    });

    // Hide the dropdown if the user clicks anywhere else on the document
    document.addEventListener("click", function() {
        dropdownContent.style.display = "none";
    });
});

// ✅ Fetch initial data and populate buyers
fetchBuyers();
fetchSalesAndReturns(); // Start fetching sales data and rendering
