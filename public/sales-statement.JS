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
            buyerFilter.innerHTML = '<option value="all">All Buyers</option>'; // Default option
            data.forEach(buyer => {
                const option = document.createElement('option');
                option.value = buyer.name; // Use buyer name as the filter value
                option.textContent = buyer.name;
                buyerFilter.appendChild(option);
            });
        })
        .catch(error => console.error('Error fetching buyers:', error));
}

// Fetch sales statement and purchase return data with filtering
function fetchSalesAndReturns(buyerName = 'all', startDate = '', endDate = '') {
    fetch('/buyers/list') // ✅ Fetch buyers first
        .then(response => response.json())
        .then(buyersData => {
            console.log('✅ Buyers Data:', buyersData); // Debugging

            // ✅ Append filters to API request
            let query = `/sales/statement?buyer_name=${buyerName}&start_date=${startDate}&end_date=${endDate}`;

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
        const adjustedBalance = adjustedPurchaseAmount - totalPaidAmount; // ✅ Correct formula

        totalPurchase += adjustedPurchaseAmount;
        totalPaid += totalPaidAmount;
        totalUnpaid += adjustedBalance; // ✅ Corrected Balance Calculation

        // ✅ Append Row to Sales Table
        const row = `
            <tr>
                <td>${index + 1}</td>
                <td>${buyerName}</td>
                <td>${formatNumberWithCommas(adjustedPurchaseAmount)}</td> <!-- ✅ Adjusted Amount -->
                <td>${formatNumberWithCommas(totalPaidAmount)}</td> <!-- ✅ Corrected Receipt (BDT) -->
                <td>${formatNumberWithCommas(adjustedBalance)}</td> <!-- ✅ Corrected Balance Calculation -->
            </tr>
        `;
        tableBody.innerHTML += row;
    });

    // ✅ Update Footer Totals
    document.getElementById('sum-total-purchase').textContent = formatNumberWithCommas(totalPurchase);
    document.getElementById('sum-total-paid').textContent = formatNumberWithCommas(totalPaid);
    document.getElementById('sum-total-unpaid').textContent = formatNumberWithCommas(totalUnpaid);

    console.log('✅ Updated Sales Table Successfully');
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



// ✅ Add event listener for filters
document.getElementById('apply-filters').addEventListener('click', function () {
    const buyerName = document.getElementById('buyer-filter').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    console.log(`🔍 Applying filters: Buyer=${buyerName}, Start Date=${startDate}, End Date=${endDate}`);
    
    fetchSalesAndReturns(buyerName, startDate, endDate); // ✅ Pass selected filters
});

// Add event listener for export to Excel
document.getElementById('export-sales-statement').addEventListener('click', function () {
    const table = document.getElementById('sales-statement-table');
    const workbook = XLSX.utils.table_to_book(table, { sheet: "Sales Statement" });
    const fileName = `Sales_Statement_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
});

// Add event listener for export to PDF
document.getElementById('export-pdf').addEventListener('click', function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const table = document.getElementById('timeline-table');
    const buyerDropdown = document.getElementById('buyer-dropdown');
    const selectedBuyerId = buyerDropdown.value; // Get selected buyer's ID
    const buyerName = buyerDropdown.selectedOptions[0].text; // Get selected buyer's name

    // Fetch buyer location from the database based on selected buyer ID
    fetch(`/buyers/location/${selectedBuyerId}`)
        .then(response => response.json())
        .then(data => {
            const buyerLocation = data.location; // Fetch the location of the buyer
            const currentDate = new Date().toLocaleDateString(); // Current Date

            // Add Logo to the top-left corner (optional)
            doc.addImage('path_to_logo.png', 'PNG', 14, 10, 30, 30);

            // Header Section
            doc.setFontSize(16); // Header font size
            doc.setFont("helvetica", "bold"); // Set font to Helvetica and bold
            doc.text("INVOICE TO:", 14, 20);
            doc.text(`Buyer: ${buyerName}`, 14, 30);
            doc.text(`Location: ${buyerLocation}`, 14, 40);
            doc.text(`Date: ${currentDate}`, 14, 50);

            // Table Section with custom styling
            doc.autoTable({
                html: table,
                startY: 60, // Start Y position of the table
                theme: 'grid', // Grid theme for the table
                headStyles: {
                    fillColor: [0, 123, 255], // Header background color
                    textColor: [255, 255, 255], // Text color for header
                    fontSize: 10, // Font size for header
                    fontStyle: 'bold', // Font style for header
                },
                bodyStyles: {
                    fontSize: 9, // Font size for table body
                    textColor: [0, 0, 0], // Text color for table body
                },
                margin: { top: 10, left: 10, right: 10, bottom: 10 }, // Margins for the table
                columnStyles: {
                    0: { halign: 'left' }, // Align first column to the left
                    1: { halign: 'center' }, // Align second column to the center
                },
            });

            // Footer Section with custom styling
            const footerText = "Thank You For Your Business\nGenerated by bYTE Ltd.\nFor inquiries, contact support@lsgroup.com.bd";
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8); // Footer font size
            doc.setTextColor(100); // Light gray text color
            const pageHeight = doc.internal.pageSize.height; // Get page height
            doc.text(footerText, 14, pageHeight - 40); // Position footer text at the bottom of the page

            // Save PDF
            doc.save('buyer_timeline.pdf');
        })
        .catch(error => {
            console.error("Error fetching buyer location:", error);
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
fetchSalesAndReturns();
