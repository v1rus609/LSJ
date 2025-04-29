// Fetch and populate buyers in the dropdown
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

    // Fetch and display filtered payment history when a buyer is selected
    const buyerName = buyerFilter.value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    fetchPaymentHistory(buyerName, startDate, endDate);
});

// Function to fetch and display payment history with optional filtering by buyer and date
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
                let actionsCell = '';
                if (window.isAdmin) {
                    actionsCell = `
                        <td>
                            <button class="edit-btn" data-id="${payment.id}"><span class="edit-text">Edit</span><i class="fas fa-edit"></i></button>
                            <button class="delete-btn" data-id="${payment.id}"><span class="delete-text">Delete</span><i class="fas fa-trash-alt"></i></button>
                        </td>
                    `;
                }

                row.innerHTML = `
                    <td>${payment.buyer_name || 'N/A'}</td>
                    <td>${formatDate(payment.payment_date)}</td>
                    <td>${payment.particulars || 'N/A'}</td>
                    <td>${formatNumberWithCommas(payment.bank_amount.toFixed(2))}</td>
                    <td>${formatNumberWithCommas(payment.cash_amount.toFixed(2))}</td>
                    <td>${formatNumberWithCommas(payment.total.toFixed(2))}</td>
                    ${actionsCell}
                `;
                tableBody.appendChild(row);
            });

            // Display total received
            totalReceivedField.textContent = formatNumberWithCommas(data.totalReceived.toFixed(2));
        })
        .catch(error => console.error('Error fetching payment history:', error));
}

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

// Event listener for the date filter
document.getElementById('apply-date-filter').addEventListener('click', function () {
    const buyerName = document.getElementById('buyer-filter').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    fetchPaymentHistory(buyerName, startDate, endDate);
});


// Role check before calling anything
fetch('/check-role')
    .then(res => res.json())
    .then(data => {
        if (!data.loggedIn) {
            window.location.href = '/login.html';
            return;
        }

        window.isAdmin = data.role === 'Admin';
		
		        if (!window.isAdmin) {
								// 🔒 Hide Admin-only navbar links
                    const protectedLinks = document.querySelectorAll('.admin-only');
                    protectedLinks.forEach(link => link.style.display = 'none');
        }

        // Load history after confirming role
        fetchPaymentHistory();
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
    let target = event.target;

    // Ensure we always target the button (even if clicking on the icon inside it)
    if (target.tagName === 'I') {
        target = target.closest('button'); 
    }

    if (target && target.classList.contains('edit-btn')) {
        const id = target.getAttribute('data-id');  // Get the correct ID

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
            })
            .catch(err => console.error('Error fetching payment data:', err));
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
    let target = event.target;

    // Ensure we always target the button (even if clicking on the icon inside it)
    if (target.tagName === 'I') {
        target = target.closest('button');
    }

    if (target && target.classList.contains('delete-btn')) {
        const id = target.getAttribute('data-id');
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

// Function to export table to PDF with a watermark
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
    const fileName = `Payment_History_${sanitizedBuyerName}_${formattedDate}_${formattedTime}.pdf`;

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
            doc.text("Payment History", pageWidth - 50, 11); // Header title

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
        const table = document.getElementById('payment-history-table');
        
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

        // Example export to Excel function (already implemented)
        function exportToExcel() {
		const table = document.getElementById('payment-history-table');
		const workbook = XLSX.utils.table_to_book(table, { sheet: "Payment History" });
		const fileName = `Payment_History_${new Date().toISOString().slice(0, 10)}.xlsx`;
		XLSX.writeFile(workbook, fileName);

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
