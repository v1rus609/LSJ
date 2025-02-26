document.addEventListener('DOMContentLoaded', function () {
    const buyerFilter = document.getElementById('buyer-filter');
    const containerFilter = document.getElementById('container-filter');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const tableBody = document.getElementById('return-history-table').querySelector('tbody');
    const totalRow = document.getElementById('total-row'); // Total row for Returned KG and Total Amount

    // ✅ Fetch and populate buyers in the dropdown
    function fetchBuyers() {
        fetch('/buyers/list')
            .then(response => response.json())
            .then(data => {
                buyerFilter.innerHTML = '<option value="0">All Buyers</option>';
                data.forEach(buyer => {
                    const option = document.createElement('option');
                    option.value = buyer.id;
                    option.textContent = buyer.name;
                    buyerFilter.appendChild(option);
                });
            })
            .catch(error => console.error('Error fetching buyers:', error));
    }

    // ✅ Fetch and populate containers based on the selected buyer
    function fetchContainers(buyerId = null) {
        containerFilter.innerHTML = '<option value="0">Select Container</option>';

        let url = buyerId && buyerId !== "0" ? `/get-containers-by-buyer?id=${buyerId}` : '/get-all-containers';

        fetch(url)
            .then(response => response.json())
            .then(data => {
                data.forEach(container => {
                    const option = document.createElement('option');
                    option.value = container.id;
                    option.textContent = container.container_number;
                    containerFilter.appendChild(option);
                });
            })
            .catch(error => console.error('Error fetching containers:', error));
    }

    // ✅ Fetch return history with applied filters
    function fetchReturnHistory() {
        let query = '/purchase-returns?';

        // Get filter values
        const buyerId = buyerFilter.value;
        const containerId = containerFilter.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        // Append filters to query
        if (buyerId && buyerId !== "0") query += `buyer=${buyerId}&`;
        if (containerId && containerId !== "0") query += `container=${containerId}&`;
        if (startDate) query += `start_date=${startDate}&`;
        if (endDate) query += `end_date=${endDate}`;

        fetch(query)
            .then(response => response.json())
            .then(data => {
                tableBody.innerHTML = ''; // Clear the existing table data

                let totalReturnedKg = 0;
                let totalAmount = 0;

                if (data.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="7">No data found</td></tr>';
                }

                data.forEach((returnRecord, index) => {
                    const row = document.createElement('tr');
                    row.innerHTML = ` 
                        <td>${index + 1}</td>
                        <td>${returnRecord.buyer_name}</td>
                        <td>${returnRecord.container_number}</td>
                        <td>${formatDate(returnRecord.return_date)}</td>
                        <td>${formatNumberWithCommas(returnRecord.returned_kg)}</td>
                        <td>${formatNumberWithCommas(returnRecord.returned_price_per_kg)}</td>
                        <td>${formatNumberWithCommas(returnRecord.total_amount)}</td>
                        <td>
                            <button class="edit-btn" data-id="${returnRecord.id}">Edit</button>
                            <button class="delete-btn" data-id="${returnRecord.id}">Delete</button>
                        </td>
                    `;
                    tableBody.appendChild(row);

                    // Add to total values
                    totalReturnedKg += parseFloat(returnRecord.returned_kg) || 0;
                    totalAmount += parseFloat(returnRecord.total_amount) || 0;
                });

                // ✅ Update total row
                totalRow.innerHTML = `
                    <td colspan="4" style="text-align: center;"><strong>Total</strong></td>
                    <td><strong>${formatNumberWithCommas(totalReturnedKg)}</strong></td>
                    <td></td>
                    <td><strong>${formatNumberWithCommas(totalAmount)}</strong></td>
                `;
            })
            .catch(error => console.error('Error fetching return history:', error));
    }

    // ✅ Automatically update return history when changing filters
    buyerFilter.addEventListener('change', function () {
        const buyerId = buyerFilter.value;

        // Fetch containers based on selected buyer
        fetchContainers(buyerId);

        // Fetch return history based on filters
        fetchReturnHistory();
    });

    containerFilter.addEventListener('change', fetchReturnHistory);
    startDateInput.addEventListener('change', fetchReturnHistory);
    endDateInput.addEventListener('change', fetchReturnHistory);

    // ✅ Helper function: Format numbers with commas
    function formatNumberWithCommas(number) {
        return parseFloat(number).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // ✅ Helper function: Format dates to dd-mm-yyyy
    function formatDate(dateString) {
        const [year, month, day] = dateString.split('-');
        return `${day}-${month}-${year}`;
    }
	


    // ✅ Initial fetch when the page loads
    fetchBuyers();
    fetchContainers();
    fetchReturnHistory();
});



// Fetch the container options dynamically and set the selected container
function fetchContainers(buyerId) {
    const containerFilter = document.getElementById('container-id');
    containerFilter.innerHTML = '<option value="0">Select Container</option>';

    fetch(`/get-containers-by-buyer?id=${buyerId}`)
        .then(response => response.json())
        .then(data => {
            data.forEach(container => {
                const option = document.createElement('option');
                option.value = container.id;
                option.textContent = container.container_number;
                containerFilter.appendChild(option);
            });
        })
        .catch(error => console.error('Error fetching containers:', error));
}

// Handle Edit button functionality
document.addEventListener('click', function (event) {
    if (event.target.classList.contains('edit-btn')) {
        const id = event.target.getAttribute('data-id');  // Get the correct ID
        
        // Fetch return record by ID and populate the edit form
        fetch(`/purchase-return/${id}`)
            .then(response => response.json())
            .then(data => {
                // Populate form fields
                document.getElementById('return-id').value = data.id;
                document.getElementById('return-date').value = data.return_date; // Set return date
                document.getElementById('returned-kg').value = data.returned_kg;  // Set returned kg
                document.getElementById('returned-price-per-kg').value = data.returned_price_per_kg;  // Set returned price per kg
                document.getElementById('total-amount').value = data.total_amount;  // Set total amount
                
                // Set the buyer name (no need to submit buyer_name, only show it)
                document.getElementById('buyer-name').value = data.buyer_name;  // Set the buyer name from the database

                // Set the container number (no need to submit container_id, only show it)
                document.getElementById('container-name').value = data.container_number;  // Set container name (not container_id)
                
                // Show the modal for editing
                document.getElementById('edit-return-form').style.display = 'block';
            });
    }
});

	
// Close the edit modal
document.getElementById('close-edit-btn').addEventListener('click', function () {
    document.getElementById('edit-return-form').style.display = 'none';
});
	
document.getElementById('returned-kg').addEventListener('input', calculateTotalAmount);
document.getElementById('returned-price-per-kg').addEventListener('input', calculateTotalAmount);

function calculateTotalAmount() {
    const returnedKg = parseFloat(document.getElementById('returned-kg').value) || 0;
    const pricePerKg = parseFloat(document.getElementById('returned-price-per-kg').value) || 0;
    
    const totalAmount = returnedKg * pricePerKg;
    
    // Update the Total Amount field
    document.getElementById('total-amount').value = totalAmount.toFixed(2);  // Ensure 2 decimal points
}

// Submit the form without manually entering Total Amount
document.getElementById('return-form').addEventListener('submit', function (event) {
    event.preventDefault();  // Prevent default form submission

    const returnData = {
        id: document.getElementById('return-id').value,
        return_date: document.getElementById('return-date').value,
        returned_kg: document.getElementById('returned-kg').value,
        returned_price_per_kg: document.getElementById('returned-price-per-kg').value,
        total_amount: document.getElementById('total-amount').value  // Total amount is now auto-calculated
    };

    console.log('Sending update request with data:', returnData);  // Log the data to verify

    // Update the return record via API (without container_id)
    fetch(`/purchase-return/update`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(returnData)  // Send returnData (no container_id)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Return record updated successfully');
            location.reload();  // Reload the page to reflect changes
        } else {
            alert('Failed to update return record');
        }
    })
    .catch(error => console.error('Error updating return record:', error));
});



// Handle Delete button functionality
document.addEventListener('click', function (event) {
    if (event.target.classList.contains('delete-btn')) {
        const id = event.target.getAttribute('data-id');
        console.log('Deleting return record with ID:', id); // Log the ID to check if it's undefined

        if (!id) {
            console.error("ID is missing for the delete button.");
            return; // Prevent the request from being sent if ID is missing
        }

        // Show confirmation dialog before proceeding with deletion
        const confirmed = confirm('Are you sure you want to delete this return record?');
        if (!confirmed) {
            return;  // If not confirmed, stop the delete process
        }

        // Proceed with the delete request
        fetch(`/purchase-return/delete/${id}`, { method: 'DELETE' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Return record deleted successfully');
                    fetchReturnHistory();  // Refresh the return history after deletion
                } else {
                    alert('Failed to delete return record');
                }
            })
            .catch(error => console.error('Error deleting return record:', error));
    }
});


 // Add event listener for the Excel export button
    document.getElementById('export-excel-return-history').addEventListener('click', function () {
        const table = document.getElementById('return-history-table'); // Get the return history table

        // Create a new workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.table_to_sheet(table); // Convert HTML table to sheet

        // Add sheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Return History');

        // Generate and download the Excel file
        XLSX.writeFile(wb, 'return_history.xlsx');
    });


    // Add event listener for the PDF export button
    document.getElementById('export-pdf-return-history').addEventListener('click', function () {
        const { jsPDF } = window.jspdf;  // Access jsPDF from window.jspdf
        const doc = new jsPDF();

        // --- Header with Logo ---
        const headerBarHeight = 20;
        doc.setFillColor(49, 178, 230); // Set background color for the header
        doc.rect(0, 0, doc.internal.pageSize.width, headerBarHeight, 'F'); // Draw header bar
        doc.addImage('/public/lsg.png', 'PNG', 14, 5, 30, 10);  // Add logo
        doc.setFontSize(14); 
        doc.setFont("helvetica", "bold"); 
        doc.setTextColor(255, 255, 255); 
        doc.text("Return History", doc.internal.pageSize.width - 50, 12); // Title text

        // Ensure buyer dropdown exists
        const buyerDropdown = document.getElementById('buyer-filter'); 
        const selectedBuyerId = buyerDropdown.value; // Get selected buyer's ID
        const buyerName = buyerDropdown.selectedOptions[0] ? buyerDropdown.selectedOptions[0].text : "All Buyers"; // Get selected buyer's name or 'All Buyers'
        
        // --- Fetch Buyer Location from Database ---
        let buyerLocation = '';
        if (selectedBuyerId !== "0") { // If a buyer is selected, fetch their location from the backend
            fetch(`/buyers/location/${selectedBuyerId}`)
                .then(response => response.json())
                .then(data => {
                    buyerLocation = data.location || ''; // Store buyer's location if available
                    exportPDF(buyerName, buyerLocation); // Call export function with data
                })
                .catch(error => console.error('Error fetching buyer location:', error));
        } else {
            // If no buyer selected, call export directly with no location
            exportPDF(buyerName, buyerLocation);
        }

        // Function to export PDF
        function exportPDF(buyerName, buyerLocation) {
            // --- INVOICE TO and Date Section ---
            const currentDate = new Date();
            const formattedDate = currentDate.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });

            // Set "INVOICE TO" section
            const invoiceYPosition = 30;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
			doc.setFont("helvetica", "bold");
            doc.text("INVOICE TO:", 14, invoiceYPosition);
			doc.setFont("helvetica", "normal"); // Set font style to normal
            doc.text(buyerName, 14, invoiceYPosition + 5);
            if (buyerLocation) doc.text(`${buyerLocation}`, 14, invoiceYPosition + 10); 

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
            const table = document.getElementById('return-history-table');
            // --- Table Section ---
            doc.autoTable({
                html: table,
                startY: headerBarHeight + 30, // Position table below the header
                theme: 'grid', // Grid theme for the table
                headStyles: {
                    fillColor: [0, 0, 0], // Header background color
                    textColor: [255, 255, 255], // Text color for header
                    fontSize: 8,
                    fontStyle: 'bold',
                },
                bodyStyles: {
                    fontSize: 9,
                    textColor: [0, 0, 0], // Text color for table body
                },
                margin: { top: 10, left: 10, right: 10, bottom: 10 },
                columnStyles: {
                    0: { halign: 'left' },
                    1: { halign: 'left' },
                    // Right-align the last column (assuming it's the totals column)
                    [table.rows[0].cells.length - 1]: { halign: 'LEFT' },
                },
                footStyles: {
                    fillColor: [220, 220, 220], // Set footer background color (light gray)
                    textColor: [0, 0, 0], // Set text color for the footer row
                    fontSize: 10,
                    fontStyle: 'bold',
                },
            });
					// --- Footer Section ---
		const line1 = "Thank You For Your Business";
		const line2 = "Generated by bYTE Ltd.";
		const line3 = "For inquiries, contact support@lsgroup.com.bd";

		doc.setFont("helvetica", "normal"); // Default font style
		doc.setFontSize(8); // Default font size for other lines
		doc.setTextColor(0, 0, 0); // Black text color
		const pageHeight = doc.internal.pageSize.height;

		// Calculate the width of each line to center-align them
		const line1Width = doc.getTextWidth(line1);
		const line2Width = doc.getTextWidth(line2);
		const line3Width = doc.getTextWidth(line3);

		// Calculate the x-position for center alignment of each line
		const xPosition1 = (doc.internal.pageSize.width - line1Width) / 2.3;
		const xPosition2 = (doc.internal.pageSize.width - line2Width) / 2;
		const xPosition3 = (doc.internal.pageSize.width - line3Width) / 2;

		// Set the font to bold and font size 12 for the first line
		doc.setFont("helvetica", "bold");
		doc.setFontSize(12); // Font size for "Thank You For Your Business"
		doc.text(line1, xPosition1, pageHeight - 40); // First line

		// Set the font back to normal and font size 8 for the other lines
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8); // Font size for other lines
		doc.text(line2, xPosition2, pageHeight - 25); // Second line
		doc.text(line3, xPosition3, pageHeight - 20); // Third line

            // Save PDF
            doc.save('return_history.pdf');
        }
    });

    // Function to fetch and populate buyers in the dropdown
    function fetchBuyers() {
        fetch('/buyers/list')
            .then(response => response.json())
            .then(data => {
                const buyerFilter = document.getElementById('buyer-filter');
                buyerFilter.innerHTML = '<option value="0">All Buyers</option>';
                data.forEach(buyer => {
                    const option = document.createElement('option');
                    option.value = buyer.id;
                    option.textContent = buyer.name;
                    buyerFilter.appendChild(option);
                });
            })
            .catch(error => console.error('Error fetching buyers:', error));
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