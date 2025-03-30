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
    tableBody.innerHTML = '';

    let totalPurchase = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;

    // ✅ Step 1: Create a map linking buyer_name to buyer_id
    const buyerIdMap = {};
    buyersData.forEach(buyer => {
        buyerIdMap[buyer.name] = buyer.id;
    });

    console.log('🔍 Buyer ID Map:', buyerIdMap);

    salesData.forEach((record, index) => {
        const buyerName = record.buyer_name || 'N/A';
        const totalPurchaseOriginal = record.total_purchase || 0;
        const totalPaidAmount = record.total_paid || 0;
        const totalUnpaidAmount = record.total_unpaid || 0;

        // ✅ Step 2: Find the correct `buyer_id`
        const buyerId = buyerIdMap[buyerName];

        if (!buyerId) {
            console.warn(`⚠ No matching buyer_id found for ${buyerName}`);
            return;
        }

        // ✅ Step 3: Get the Correct Purchase Returns for This Buyer
        const buyerReturns = purchaseReturnsData
            .filter(returnData => returnData.buyer_id == buyerId)
            .reduce((sum, returnItem) => sum + (returnItem.total_amount || 0), 0);

        console.log(`🟢 Buyer: ${buyerName} (ID: ${buyerId}) | Purchase: ${totalPurchaseOriginal} | Returned: ${buyerReturns}`);

        // ✅ Step 4: Adjust Purchase and Balance Columns
        const adjustedPurchaseAmount = totalPurchaseOriginal - buyerReturns;

        // Fetch the opening balance for this buyer
        fetch(`/buyers/opening-balance/${buyerId}`)
            .then(response => response.json())
            .then(openingBalanceData => {
                const openingBalance = openingBalanceData.opening_balance || 0;
                const adjustedPurchaseWithOpeningBalance = adjustedPurchaseAmount + openingBalance;

                // Calculate the adjusted balance
                const adjustedBalance = adjustedPurchaseWithOpeningBalance - totalPaidAmount;

                totalPurchase += adjustedPurchaseWithOpeningBalance;
                totalPaid += totalPaidAmount;
                totalUnpaid += adjustedBalance;

                // ✅ Append Row to Sales Table
                const row = `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${buyerName}</td>
                        <td>${formatNumberWithCommas(adjustedPurchaseWithOpeningBalance)}</td> <!-- ✅ Adjusted Purchase with Opening Balance -->
                        <td>${formatNumberWithCommas(totalPaidAmount)}</td> <!-- ✅ Corrected Receipt (BDT) -->
                        <td>${formatNumberWithCommas(adjustedBalance)}</td> <!-- ✅ Corrected Balance Calculation -->
                    </tr>
                `;
                tableBody.innerHTML += row;

                // ✅ Update Footer Totals
                document.getElementById('sum-total-purchase').textContent = formatNumberWithCommas(totalPurchase);
                document.getElementById('sum-total-paid').textContent = formatNumberWithCommas(totalPaid);
                document.getElementById('sum-total-unpaid').textContent = formatNumberWithCommas(totalUnpaid);

                console.log('✅ Updated Sales Table Successfully');
            })
            .catch(error => console.error('❌ Error fetching opening balance for buyer:', error));
    });
}

fetch('/check-role')
    .then(res => res.json())
    .then(data => {
        if (!data.loggedIn) {
            window.location.href = '/login.html';
            return;
        }

        isAdmin = data.role === 'Admin';

        if (!isAdmin) {
            document.getElementById('export-sales-statement')?.remove();
            document.getElementById('export-pdf-btn')?.remove();
        }

        fetchFilters();
        fetchPurchases();
    });

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

// Function to generate and save PDF
function generatePDF(doc, buyerName, buyerLocation, formattedDate, fileName) {

        // --- Header with Logo ---
        const headerBarHeight = 20;
        doc.setFillColor(49, 178, 230);
        doc.rect(0, 0, doc.internal.pageSize.width, headerBarHeight, 'F');
        doc.addImage('/public/lsg.png', 'PNG', 14, 5, 30, 10);
        doc.setFontSize(14); 
        doc.setFont("helvetica", "bold"); 
        doc.setTextColor(255, 255, 255); 
        doc.text("Sales Statement", doc.internal.pageSize.width - 50, 12);

        // --- INVOICE TO Section ---
        const invoiceYPosition = 30;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text("INVOICE TO:", 14, invoiceYPosition);
        doc.setFont("helvetica", "normal");
        doc.text(buyerName, 14, invoiceYPosition + 5);
        
        // **Only show buyer location inside the PDF, not in filename**
        if (buyerLocation) {
            doc.text(buyerLocation, 14, invoiceYPosition + 10);
        }

        // --- Date Section ---
        const dateLabel = "DATE:";
        const dateText = `${formattedDate}`;
        const dateLabelWidth = doc.getTextWidth(dateLabel);
        const xPosition = doc.internal.pageSize.width - dateLabelWidth - 40; // Right align

        doc.setFont("helvetica", "bold");
        doc.text(dateLabel, xPosition, invoiceYPosition);
        doc.setFont("helvetica", "normal");
        doc.text(dateText, xPosition, invoiceYPosition + 5);

        // --- Table Section ---
        const table = document.getElementById('sales-statement-table');
        doc.autoTable({
            html: table,
            theme: 'grid',
            startY: headerBarHeight + 30,
            margin: { horizontal: 10 },
            headStyles: {
                fillColor: [0, 0, 0],
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: 'bold',
            },
            bodyStyles: {
                fontSize: 9,
                textColor: [0, 0, 0],
            },
            footStyles: {
                fillColor: [220, 220, 220],
                textColor: [0, 0, 0],
                fontSize: 10,
                fontStyle: 'bold',
            },
        });
		const watermarkPath = "/public/watermark.png"; // ✅ Change to your actual watermark path
const watermarkImg = new Image();
watermarkImg.src = watermarkPath;

watermarkImg.onload = function () {
    // ✅ Define page dimensions inside the onload function
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    doc.setGState(new doc.GState({ opacity: 0.2 })); // ✅ Set opacity (faint watermark)
    doc.addImage(watermarkImg, 'PNG', pageWidth / 4, pageHeight / 3, pageWidth / 2, pageHeight / 4);
    doc.setGState(new doc.GState({ opacity: 1 })); // ✅ Restore normal opacity

        // --- Footer Section ---
        const line1 = "Thank You For Your Business";
        const line2 = "Generated by bYTE Ltd.";
        const line3 = "For inquiries, contact support@lsgroup.com.bd";

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);


        const line1Width = doc.getTextWidth(line1);
        const line2Width = doc.getTextWidth(line2);
        const line3Width = doc.getTextWidth(line3);

        const xPosition1 = (doc.internal.pageSize.width - line1Width) / 2.3;
        const xPosition2 = (doc.internal.pageSize.width - line2Width) / 2;
        const xPosition3 = (doc.internal.pageSize.width - line3Width) / 2;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(line1, xPosition1, pageHeight - 40);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(line2, xPosition2, pageHeight - 25);
        doc.text(line3, xPosition3, pageHeight - 20);

        // Save PDF with dynamic filename
        doc.save(fileName);
    };
}

    document.getElementById('logout-btn')?.addEventListener('click', function (e) {
        e.preventDefault();
        fetch('/logout', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/login.html';
                } else {
                    alert('Logout failed.');
                }
            })
            .catch(err => {
                console.error('Logout error:', err);
                alert('Something went wrong during logout.');
            });
    });


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
