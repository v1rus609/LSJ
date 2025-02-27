// Declare a variable to temporarily store the particulars value
let storedParticulars = '';

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
                    <td>${payment.buyer_name || 'N/A'}</td>
                    <td>${formatDate(payment.payment_date)}</td>
                    <td>${payment.particulars || 'N/A'}</td>
                    <td>${formatNumberWithCommas(payment.bank_amount.toFixed(2))}</td>
                    <td>${formatNumberWithCommas(payment.cash_amount.toFixed(2))}</td>
                    <td>${formatNumberWithCommas(payment.total.toFixed(2))}</td>
                    <td>
                        <button class="edit-btn" data-id="${payment.id}">Edit</button>
                        <button class="delete-btn" data-id="${payment.id}">Delete</button>
                    </td>
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

// Function to toggle bank/cash fields based on the selected payment method
function togglePaymentFields() {
    const paymentMethod = document.getElementById('payment-method').value;
    const bankAmountField = document.getElementById('bank-amount');
    const cashAmountField = document.getElementById('cash-amount');
    const particularsField = document.getElementById('particulars');

    if (paymentMethod === 'cash') {
        bankAmountField.disabled = true;
        cashAmountField.disabled = false;
        // Store the particulars value before resetting it
        storedParticulars = particularsField.value;
        particularsField.value = ''; // Reset the particulars field

        // Transfer amount from Bank Amount to Cash Amount if payment method is switched to cash
        cashAmountField.value = bankAmountField.value;
        bankAmountField.value = 0;
    } else if (paymentMethod === 'bank') {
        cashAmountField.disabled = true;
        bankAmountField.disabled = false;
        // Restore the particulars value if switched back to bank
        particularsField.value = storedParticulars;

        // Transfer amount from Cash Amount to Bank Amount if payment method is switched to bank
        bankAmountField.value = cashAmountField.value;
        cashAmountField.value = 0;
    }
}

// Listen for changes in payment-method dropdown and toggle input fields accordingly
document.getElementById('payment-method').addEventListener('change', function () {
    togglePaymentFields();
});

// Edit button functionality
document.addEventListener('click', function (event) {
    if (event.target.classList.contains('edit-btn')) {
        const id = event.target.getAttribute('data-id');  // Get the correct ID
        
        // Fetch payment record by ID and populate the edit form
        fetch(`/payment/${id}`)
            .then(response => response.json())
            .then(data => {
                // Populate form fields
                document.getElementById('payment-id').value = data.id;
                document.getElementById('payment-date').value = data.payment_date;
                document.getElementById('particulars').value = data.particulars;
                document.getElementById('bank-amount').value = data.bank_amount;
                document.getElementById('cash-amount').value = data.cash_amount;
                document.getElementById('payment-method').value = data.payment_method;

                // Disable the buyer-name field and populate it (so it can't be edited)
                const buyerNameField = document.getElementById('buyer-name');
                buyerNameField.value = data.buyer_name;
                buyerNameField.disabled = true;

                // Show the modal for editing
                document.getElementById('edit-payment-form').style.display = 'block';
            });
    }
});
// Close the edit modal
document.getElementById('close-edit-btn').addEventListener('click', function () {
    document.getElementById('edit-payment-form').style.display = 'none';
});


// Update payment record with confirmation dialog
document.getElementById('update-payment-btn').addEventListener('click', function () {
    // Show confirmation dialog before proceeding with the update
    const confirmed = confirm('Are you sure you want to update this payment record?');
    if (!confirmed) {
        return;  // If not confirmed, stop the update process
    }

    const paymentData = {
        id: document.getElementById('payment-id').value,
        payment_date: document.getElementById('payment-date').value,
        particulars: document.getElementById('particulars').value,
        bank_amount: document.getElementById('bank-amount').value,
        cash_amount: document.getElementById('cash-amount').value,
        payment_method: document.getElementById('payment-method').value,
        buyer_name: document.getElementById('buyer-name').value // Ensure buyer_name is included
    };

    console.log('Sending update request with data:', paymentData);  // Log the data to verify it's correct

    fetch(`/payment/update`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentData)  // Send paymentData with buyer_name included
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Payment record updated successfully');
            fetchPaymentHistory();  // Refresh the payment history
            document.getElementById('edit-payment-form').style.display = 'none'; // Hide the modal
        } else {
            alert('Failed to update payment record');
        }
    })
    .catch(error => console.error('Error updating payment record:', error));
});

// Handle Delete button functionality with confirmation
document.addEventListener('click', function (event) {
    if (event.target.classList.contains('delete-btn')) {
        const id = event.target.getAttribute('data-id');
        console.log('Deleting payment with ID:', id);

        if (!id) {
            console.error("ID is missing for the delete button.");
            return; // Prevent the request from being sent if ID is missing
        }

        // Show confirmation dialog before proceeding with deletion
        const confirmed = confirm('Are you sure you want to delete this payment record?');
        if (!confirmed) {
            return;  // If not confirmed, stop the delete process
        }

        // Proceed with the delete request
        fetch(`/payment/delete/${id}`, { method: 'DELETE' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Payment record deleted successfully');
                    fetchPaymentHistory();  // Refresh the payment history
                } else {
                    alert('Failed to delete payment record');
                }
            })
            .catch(error => console.error('Error deleting payment record:', error));
    }
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


// Fetch all payment history on page load
document.addEventListener("DOMContentLoaded", function() {
    fetchPaymentHistory();
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
