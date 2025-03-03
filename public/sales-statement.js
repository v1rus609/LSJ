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

// Add event listener for export to PDF
document.getElementById('export-sales-statement-pdf').addEventListener('click', () => {
    const fetchedSales = [];
    const rows = document.querySelectorAll('#sales-statement-table tbody tr');

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        fetchedSales.push({
            sl_no: cells[0].textContent,
            buyer_name: cells[1].textContent,
            total_purchase: getRawNumber(cells[2].textContent),
            total_paid: getRawNumber(cells[3].textContent),
            total_unpaid: getRawNumber(cells[4].textContent),
        });
    });

    const totals = {
        totalPurchase: getRawNumber(document.getElementById('sum-total-purchase').textContent),
        totalPaid: getRawNumber(document.getElementById('sum-total-paid').textContent),
        totalUnpaid: getRawNumber(document.getElementById('sum-total-unpaid').textContent),
    };

    fetch('/sales/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sales: fetchedSales, totals }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.open(data.filePath, '_blank');
            } else {
                alert('Failed to generate PDF.');
            }
        })
        .catch(error => console.error('Error exporting PDF:', error));
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
