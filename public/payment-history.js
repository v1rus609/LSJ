// Fetch and populate buyers in the dropdown
fetch('/buyers/list')
    .then(response => response.json())
    .then(data => {
        const buyerFilter = document.getElementById('buyer-filter');
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'All Buyers';
        buyerFilter.appendChild(allOption);

        data.forEach(buyer => {
            const option = document.createElement('option');
            option.value = buyer.name; // Use buyer's name as the filter value
            option.textContent = buyer.name;
            buyerFilter.appendChild(option);
        });
    })
    .catch(error => console.error('Error fetching buyers:', error));

// Helper function to format numbers with commas
function formatNumberWithCommas(value) {
    return !isNaN(value) ? parseFloat(value).toLocaleString('en-US') : value;
}

// Format date to DD/MM/YYYY
function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Fetch and populate payment history with optional filtering by buyer and date
function fetchPaymentHistory(buyerName = 'all', startDate = null, endDate = null) {
    let query = `/payments/history?buyer_name=${buyerName}`;
    if (startDate) query += `&start_date=${startDate}`;
    if (endDate) query += `&end_date=${endDate}`;

    fetch(query)
        .then(response => response.json())
        .then(data => {
            const tableBody = document.getElementById('payment-history-table').querySelector('tbody');
            const totalReceivedField = document.getElementById('total-received');

            // Clear existing table rows
            tableBody.innerHTML = '';

            // Populate table rows
            data.payments.forEach(payment => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${payment.buyer_name || 'N/A'}</td> <!-- Name of Party -->
                    <td>${formatDate(payment.payment_date)}</td>
                    <td>${payment.particulars || 'N/A'}</td>
                    <td>${formatNumberWithCommas(payment.bank_amount.toFixed(2))}</td>
                    <td>${formatNumberWithCommas(payment.cash_amount.toFixed(2))}</td>
                    <td>${formatNumberWithCommas(payment.total.toFixed(2))}</td>
                `;
                tableBody.appendChild(row);
            });

            // Display total received
            totalReceivedField.textContent = formatNumberWithCommas(data.totalReceived.toFixed(2));
        })
        .catch(error => console.error('Error fetching payment history:', error));
}

// Add event listener for the date filter
document.getElementById('apply-date-filter').addEventListener('click', function () {
    const buyerName = document.getElementById('buyer-filter').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    fetchPaymentHistory(buyerName, startDate, endDate);
});

// Add event listener for export to Excel
document.getElementById('export-payment-history').addEventListener('click', function () {
    const table = document.getElementById('payment-history-table');
    const workbook = XLSX.utils.table_to_book(table, { sheet: "Payment History" });
    const fileName = `Payment_History_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
});

// Add event listener for export to PDF
document.getElementById('export-payment-history-pdf').addEventListener('click', () => {
    const fetchedPayments = []; // Gather the data displayed in the table
    const rows = document.querySelectorAll('#payment-history-table tbody tr');

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        fetchedPayments.push({
            buyer_name: cells[0].textContent, // Correct field mapping
            payment_date: cells[1].textContent,
            particulars: cells[2].textContent,
            bank_amount: parseFloat(cells[3].textContent.replace(/,/g, '')),
            cash_amount: parseFloat(cells[4].textContent.replace(/,/g, '')),
            total: parseFloat(cells[5].textContent.replace(/,/g, '')),
        });
    });

    const totalReceived = parseFloat(document.getElementById('total-received').textContent.replace(/,/g, ''));

    // Get the selected buyer
    const buyerName = document.getElementById('buyer-filter').value;

    // Send data to the backend for PDF generation
    fetch('/payments/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            payments: fetchedPayments,
            totalReceived: totalReceived,
            selectedBuyer: buyerName, // Send the selected buyer's name
        }),
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

// Fetch all payment history on page load
fetchPaymentHistory();
