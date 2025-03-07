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
    if (filters.startDate) query += `start_date=${filters.startDate}&`;
    if (filters.endDate) query += `end_date=${filters.endDate}&`;

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
                    <td>${purchase.bill_no || "N/A"}</td> 
                    <td>${formatNumberWithCommas(purchase.weight_sold || 0)}</td>
                    <td>${formatNumberWithCommas(purchase.price_per_kg || 0)}</td>
                    <td>${formatNumberWithCommas(purchase.paid_amount || 0)}</td>
                    <td>${formatNumberWithCommas(purchase.unpaid_amount || 0)}</td>
                    <td>${formatNumberWithCommas(purchase.total_price || 0)}</td>
                    <td>
                        <button class="edit-btn" data-id="${purchase.sale_id}">Edit</button>
                        <button class="delete-btn" data-id="${purchase.sale_id}">Delete</button>
                    </td>
                `;

                tableBody.appendChild(row);

                totalPaid += purchase.paid_amount;
                totalUnpaid += purchase.unpaid_amount;
                grandTotal += purchase.total_price;
            });

            document.getElementById('total-paid').textContent = formatNumberWithCommas(totalPaid);
            document.getElementById('total-unpaid').textContent = formatNumberWithCommas(totalUnpaid);
            document.getElementById('grand-total').textContent = formatNumberWithCommas(grandTotal);
        })
        .catch(error => console.error('Error fetching purchases:', error));
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

document.getElementById('apply-date-filter').addEventListener('click', function () {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    const filters = {
        buyer: document.getElementById('buyer-filter').value,
        container: document.getElementById('container-filter').value,
        startDate: startDate,
        endDate: endDate
    };

    fetchPurchases(filters);
});


// Event delegation: Handle Edit and Delete buttons
document.addEventListener('DOMContentLoaded', function () {
    // Fetch filters and purchases on page load
    fetchFilters();
    fetchPurchases();

    const table = document.getElementById('purchase-table');

    // Event delegation: Attach listeners to Edit and Delete buttons
    table.addEventListener('click', function (event) {
        if (event.target.classList.contains('edit-btn')) {
            const id = event.target.getAttribute('data-id');
            // Fetch the record data for editing
            fetch(`/purchase-record/${id}`)
                .then(response => response.json())
                .then(data => {
                    console.log('Fetched record for editing:', data);

                    // Populate the modal fields
                    document.getElementById('purchase-date').value = data.purchase_date;
                    document.getElementById('buyer-name').value = data.buyer_name || "N/A";
                    document.getElementById('buyer-filter').value = data.buyer_id;
                    document.getElementById('quantity').value = data.weight_sold;
                    document.getElementById('rate').value = data.price_per_kg;
                    document.getElementById('paid-amount').value = data.paid_amount;
                    document.getElementById('unpaid-amount').value = data.unpaid_amount;
                    document.getElementById('total-price').value = data.total_price;
                    document.getElementById('purchase-id').value = data.sale_id;
                    document.getElementById('bill-no').value = data.bill_no || ''; // Set the Bill No.

                    document.getElementById('buyer-name').disabled = true; // Disable the Buyer Name field
                    document.getElementById('edit-form').style.display = 'block'; // Show the modal
                })
                .catch(err => console.error('Error fetching purchase data:', err));
        }

        if (event.target.classList.contains('delete-btn')) {
            const id = event.target.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this record?')) {
                fetch(`/purchase-record/delete/${id}`, {
                    method: 'DELETE',
                })
                    .then(response => response.json())
                    .then(data => {
                        alert('Purchase record deleted successfully');
                        location.reload(); // Refresh the table
                    })
                    .catch(error => console.error('Error deleting purchase record:', error));
            }
        }
    });

    // Recalculate the Price and Unpaid Amount when any of the fields change
    document.getElementById('quantity').addEventListener('input', updatePriceAndUnpaidAmount);
    document.getElementById('rate').addEventListener('input', updatePriceAndUnpaidAmount);
    document.getElementById('paid-amount').addEventListener('input', updateUnpaidAmount);

    function updatePriceAndUnpaidAmount() {
        const quantity = parseFloat(document.getElementById('quantity').value) || 0;
        const rate = parseFloat(document.getElementById('rate').value) || 0;
        const price = quantity * rate;

        document.getElementById('total-price').value = price.toFixed(2); // Set the Price (Quantity * Rate)

        updateUnpaidAmount(); // Recalculate Unpaid Amount whenever Price is updated
    }

    function updateUnpaidAmount() {
        const price = parseFloat(document.getElementById('total-price').value) || 0;
        const paidAmount = parseFloat(document.getElementById('paid-amount').value) || 0;
        const unpaidAmount = price - paidAmount;

        document.getElementById('unpaid-amount').value = unpaidAmount.toFixed(2); // Set the Unpaid Amount (Price - Paid Amount)
    }

    // Close the modal when the "close" button is clicked
    document.getElementById('close-btn').addEventListener('click', function () {
        document.getElementById('edit-form').style.display = 'none'; // Hide the modal
    });

    // Update the purchase record when the Update Purchase button is clicked
    document.getElementById('update-btn').addEventListener('click', function () {
        const id = document.getElementById('purchase-id').value;
        const buyer_id = document.getElementById('buyer-filter').value;
        const purchase_date = document.getElementById('purchase-date').value;
        const quantity = document.getElementById('quantity').value;
        const rate = document.getElementById('rate').value;
        const paid_amount = document.getElementById('paid-amount').value;
        const unpaid_amount = document.getElementById('unpaid-amount').value;
        const total_price = document.getElementById('total-price').value;
        const bill_no = document.getElementById('bill-no').value;  // Get Bill No.

        const updatedPurchase = {
            id: id,
            buyer_id: buyer_id,
            purchase_date: purchase_date,
            weight_sold: quantity,
            price_per_kg: rate,
            paid_amount: paid_amount,
            unpaid_amount: unpaid_amount,
            total_price: total_price,
            bill_no: bill_no,  // Add Bill No. to the update
        };

        // Send the PUT request to update the record
        fetch('/purchase-record/update', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedPurchase)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Purchase record updated successfully');
                location.reload();
            } else {
                alert('Failed to update purchase record');
            }
        })
        .catch(error => console.error('Error updating purchase record:', error));
    });
});

        // Helper function to format numbers with commas
        function formatNumberWithCommas(number) {
            return parseFloat(number).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Ensure buyer dropdown exists
    const buyerDropdown = document.getElementById('buyer-filter'); 
    const selectedBuyerId = buyerDropdown.value; // Get selected buyer's ID
    const buyerName = buyerDropdown.selectedOptions[0] ? buyerDropdown.selectedOptions[0].text : "All Buyers"; // Get selected buyer's name or 'All Buyers'

    // Replace spaces with underscores in the buyer's name to avoid filename issues
    const sanitizedBuyerName = buyerName.replace(/\s+/g, "_");

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
    const fileName = `Purchase_History_${sanitizedBuyerName}_${formattedDate}_${formattedTime}.pdf`;

    // Fetch Buyer Location if a specific buyer is selected
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

// Function to generate and save PDF with watermark
function generatePDF(doc, buyerName, buyerLocation, formattedDate, fileName) {


        // --- Header with Logo ---
        const headerBarHeight = 20;
        doc.setFillColor(49, 178, 230);
        doc.rect(0, 0, doc.internal.pageSize.width, headerBarHeight, 'F');
        doc.addImage('/public/lsg.png', 'PNG', 14, 5, 30, 10);
        doc.setFontSize(14); 
        doc.setFont("helvetica", "bold"); 
        doc.setTextColor(255, 255, 255); 
        doc.text("Purchase History", doc.internal.pageSize.width - 50, 12);

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
        const table = document.getElementById('purchase-table');
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

    const watermarkPath = "/public/watermark.png"; // Change to your actual watermark path
    const watermarkImg = new Image();
    watermarkImg.src = watermarkPath;

    watermarkImg.onload = function () {
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;

        // Set watermark transparency and add it in the background
        doc.setGState(new doc.GState({ opacity: 0.2 })); // ✅ Set faint opacity
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






        // Example export to Excel function (already implemented)
        function exportToExcel() {
            const table = document.getElementById('purchase-table');
            const workbook = XLSX.utils.table_to_book(table, { sheet: "Purchase History" });
            XLSX.writeFile(workbook, 'Purchase_History.xlsx');
        }


function formatQuantity() {
    const inputField = document.getElementById('quantity');
    let inputValue = inputField.value;

    // Remove any non-numeric characters (except for the decimal point)
    inputValue = inputValue.replace(/[^0-9.]/g, '');

    // Split the integer and decimal parts (if any)
    let [integer, decimal] = inputValue.split('.');

    // Add commas to the integer part
    if (integer) {
        integer = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    // Reassemble the number with the decimal part if it exists
    inputField.value = decimal ? `${integer}.${decimal}` : integer;
}


// Format date to dd-mm-yyyy
function formatDate(dateString) {
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
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
