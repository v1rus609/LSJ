// Helper function to format numbers with commas
function formatNumberWithCommas(number) {
    return parseFloat(number).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function fetchFilters() {
    // Fetch buyers
    fetch('/buyers/list')
        .then(response => response.json())
        .then(data => {
            const buyerFilter = document.getElementById('buyer-filter');
            data.forEach(buyer => {
                const option = document.createElement('option');
                option.value = buyer.id;
                option.text = buyer.name;
                buyerFilter.appendChild(option);
            });
        });

    // Fetch containers
    fetch('/containers/list')
        .then(response => response.json())
        .then(data => {
            const containerFilter = document.getElementById('container-filter');
            data.forEach(container => {
                const option = document.createElement('option');
                option.value = container.id;
                option.text = container.container_number;
                containerFilter.appendChild(option);
            });
        });
}

// Fetch and display purchases based on selected filters
function fetchPurchases(filters = {}) {
    let query = '/purchases?';
    if (filters.buyer) query += `buyer=${filters.buyer}&`;
    if (filters.container) query += `container=${filters.container}&`;

    fetch(query)
        .then(response => response.json())
        .then(data => {
            const tableBody = document.getElementById('purchase-table').querySelector('tbody');
            tableBody.innerHTML = '';

            let totalPaid = 0;
            let totalUnpaid = 0;
            let grandTotal = 0;

            data.forEach((purchase, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
					<td>${formatDate(purchase.purchase_date) || "N/A"}</td>
                    <td>${purchase.buyer_name || "N/A"}</td>
                    <td>${purchase.container_number || "N/A"}</td>
                    <td>${formatNumberWithCommas(purchase.weight_sold || 0)}</td>
                    <td>${formatNumberWithCommas(purchase.price_per_kg || 0)}</td>
                    
                    <td>${formatNumberWithCommas(purchase.paid_amount || 0)}</td>
                    <td>${formatNumberWithCommas(purchase.unpaid_amount || 0)}</td>
                    <td>${formatNumberWithCommas(purchase.total_price || 0)}</td>
                `;
                tableBody.appendChild(row);

                totalPaid += purchase.paid_amount;
                totalUnpaid += purchase.unpaid_amount;
                grandTotal += purchase.total_price;
            });

            document.getElementById('total-paid').textContent = formatNumberWithCommas(totalPaid);
            document.getElementById('total-unpaid').textContent = formatNumberWithCommas(totalUnpaid);
            document.getElementById('grand-total').textContent = formatNumberWithCommas(grandTotal);
        });
}

// Apply filters immediately when a buyer or container is selected
document.getElementById('buyer-filter').addEventListener('change', function () {
    const filters = {
        buyer: this.value,
        container: document.getElementById('container-filter').value,
    };
    fetchPurchases(filters); // Trigger fetch on change
});

// Apply filters immediately when a container is selected
document.getElementById('container-filter').addEventListener('change', function () {
    const filters = {
        buyer: document.getElementById('buyer-filter').value,
        container: this.value,
    };
    fetchPurchases(filters); // Trigger fetch on change
});
// Export table to Excel
function exportToExcel() {
    const table = document.getElementById('purchase-table');
    const workbook = XLSX.utils.table_to_book(table, { sheet: "Purchase History" });
    XLSX.writeFile(workbook, 'Purchase_History.xlsx');
}

// Enable Generate Invoice button based on buyer selection
document.getElementById('buyer-filter').addEventListener('change', function () {
    const buyerId = this.value;
    const generateInvoiceButton = document.getElementById('generate-invoice');
    generateInvoiceButton.disabled = !buyerId; // Enable button if a buyer is selected
});

// Enable container filter change event
document.getElementById('container-filter').addEventListener('change', function () {
    applyFilters(); // Reapply filters whenever container is changed
});

// Add event listener for Generate Invoice button
document.getElementById('generate-invoice').addEventListener('click', generateInvoice);

function generateInvoice() {
    const buyerId = document.getElementById('buyer-filter').value;
    if (!buyerId) {
        alert('Please select a buyer to generate an invoice.');
        return;
    }

    const rows = document.querySelectorAll('#purchase-table tbody tr');
    const purchases = [];

    rows.forEach((row) => {
        const purchase = {
            purchase_date: row.children[2]?.textContent || "N/A",
            paid_amount: parseFloat(row.children[3]?.textContent.replace(/,/g, '') || 0),
            unpaid_amount: parseFloat(row.children[4]?.textContent.replace(/,/g, '') || 0),
            total_price: parseFloat(row.children[5]?.textContent.replace(/,/g, '') || 0),
        };
        purchases.push(purchase);
    });

    const totalPaid = parseFloat(document.getElementById('total-paid').textContent.replace(/,/g, ''));

    fetch('/generate-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            buyer_id: buyerId,
            purchases,
            total_paid: totalPaid,
        }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.open(data.invoicePath, '_blank'); // Open the generated invoice
            } else {
                alert('Failed to generate invoice.');
            }
        })
        .catch(error => console.error('Error generating invoice:', error));
}

// Add event listener for Generate Invoice for All Buyers button
document.getElementById('generate-all-buyers-invoice').addEventListener('click', generateAllBuyersInvoice);

function generateAllBuyersInvoice() {
    const rows = document.querySelectorAll('#purchase-table tbody tr');
    
    // Check if the table is empty
    if (rows.length === 0) {
        alert('No purchase data available to generate invoices.');
        return; // Stop further processing if the table is empty
    }

    const purchases = [];

    let totalPaid = 0;
    let totalUnpaid = 0;
    let grandTotal = 0;

    rows.forEach((row) => {
        const paidAmount = parseFloat(row.children[6]?.textContent.replace(/,/g, '') || 0);
        const purchase = {
            buyer_name: row.children[1]?.textContent || "N/A",
            container_number: row.children[2]?.textContent || "N/A",
            weight_sold: parseFloat(row.children[3]?.textContent.replace(/,/g, '') || 0),
            price_per_kg: parseFloat(row.children[4]?.textContent.replace(/,/g, '') || 0),
            purchase_date: row.children[5]?.textContent || "N/A",
            paid_amount: paidAmount,
            unpaid_amount: parseFloat(row.children[7]?.textContent.replace(/,/g, '') || 0),
            total_price: parseFloat(row.children[8]?.textContent.replace(/,/g, '') || 0),
        };

        // Update the totals
        totalPaid += paidAmount;
        totalUnpaid += purchase.unpaid_amount || 0;
        grandTotal += purchase.total_price || 0;

        purchases.push(purchase);
    });

    // If total paid or total unpaid are zero, allow invoice generation
    if (isNaN(totalPaid) || isNaN(totalUnpaid) || isNaN(grandTotal)) {
        alert('Please ensure all required data is available before generating the invoice.');
        return;
    }

    // Proceed with the fetch even if totals are zero
    fetch('/generate-all-buyers-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            purchases,
            total_paid: totalPaid,
            total_unpaid: totalUnpaid,
            grand_total: grandTotal
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            window.open(data.invoicePath, '_blank');
        } else {
            alert('Failed to generate invoice for all buyers.');
        }
    })
    .catch(error => console.error('Error generating invoice for all buyers:', error));
}


// Function to update button text and disable/enable buttons based on the buyer selection
function handleButtonState() {
    const buyerId = document.getElementById('buyer-filter').value; // Get the selected value
    const generateInvoiceButton = document.getElementById('generate-invoice');
    const generateAllBuyersButton = document.getElementById('generate-all-buyers-invoice');
    const buyerFilter = document.getElementById('buyer-filter');
    const selectedBuyerName = buyerFilter.options[buyerFilter.selectedIndex].text; // Get selected buyer name
    
    // If "All Buyers" is selected (id is "0" or "null"), disable "Generate Invoice" button
    if (buyerId === "0" || buyerId === "null" || buyerId === "") {
        generateInvoiceButton.disabled = true;
        generateInvoiceButton.style.backgroundColor = 'gray';  // Make it gray
        generateInvoiceButton.textContent = 'Generate Invoice'; // Keep default button text
        
        generateAllBuyersButton.disabled = false;  // Enable the "Generate Invoice for All Buyers" button
        generateAllBuyersButton.style.backgroundColor = '';  // Reset the background color
    } else {
        // If a specific buyer is selected, disable "Generate Invoice for All Buyers" button and enable "Generate Invoice"
        generateAllBuyersButton.disabled = true;
        generateAllBuyersButton.style.backgroundColor = 'gray';  // Make it gray
        generateInvoiceButton.disabled = false;  // Enable the "Generate Invoice" button
        generateInvoiceButton.style.backgroundColor = '';  // Reset the background color

        // Update the "Generate Invoice" button text to show the selected buyer's name
        generateInvoiceButton.textContent = `Invoice For ${selectedBuyerName}`;
    }
}

// Listen to the change event of the dropdown to update button states when selection changes
document.getElementById('buyer-filter').addEventListener('change', handleButtonState);

// Call the function once on page load to apply the correct button state
window.onload = handleButtonState;


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


function formatDate(dateString) {
    const [year, month, day] = dateString.split('-'); // Split the string by "-"
    return `${day}-${month}-${year}`; // Return in dd-mm-yyyy format
}

// Initialize page
fetchFilters();
fetchPurchases();
