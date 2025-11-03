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
                let actionCell = '';
                if (isAdmin) {
                    actionCell = `
                        <td class="action-cell">
                        <button class="edit-btn" data-id="${purchase.sale_id}"><span class="edit-text">Edit</span><i class="fas fa-edit"></i></button>
						<button class="delete-btn" data-id="${purchase.sale_id}"><span class="delete-text">Delete</span><i class="fas fa-trash-alt"></i></button>	
                        </td>
                    `;
                }

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
                    ${actionCell}
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


// Role check first before loading anything
fetch('/check-role')
    .then(res => res.json())
    .then(data => {
        if (!data.loggedIn) {
            window.location.href = '/login.html';
            return;
        }

        isAdmin = data.role === 'Admin';
		
		        if (!window.isAdmin) {

								// 🔒 Hide Admin-only navbar links
                    const protectedLinks = document.querySelectorAll('.admin-only');
                    protectedLinks.forEach(link => link.style.display = 'none');
        }

        // Fetch filters and purchases
        fetchFilters();
        fetchPurchases();
    });

fetch('/check-role')
    .then(res => res.json())
    .then(data => {
        if (!data.loggedIn) {
            window.location.href = '/login.html';
            return;
        }

        isAdmin = data.role === 'Admin';

        if (!isAdmin) {
            document.getElementById('export-btn')?.remove();
            document.getElementById('export-pdf-btn')?.remove();
        }

        fetchFilters();
        fetchPurchases();
    });
	
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

    table.addEventListener('click', function (event) {
        let target = event.target;

        // Ensure we always target the button (even if clicking on the icon inside it)
        if (target.tagName === 'I') {
            target = target.closest('button'); 
        }

        // Handle Edit Button
        if (target && target.classList.contains('edit-btn')) {
            const id = target.getAttribute('data-id');
            fetch(`/purchase-record/${id}`)
                .then(response => response.json())
                .then(data => {
                    // Fill form fields with data
                    document.getElementById('purchase-date').value = data.purchase_date;
                    document.getElementById('buyer-name').value = data.buyer_name || "N/A";
                    document.getElementById('buyer-filter').value = data.buyer_id;
                    document.getElementById('quantity').value = data.weight_sold;
                    document.getElementById('rate').value = data.price_per_kg;
                    document.getElementById('paid-amount').value = data.paid_amount;
                    document.getElementById('unpaid-amount').value = data.unpaid_amount;
                    document.getElementById('total-price').value = data.total_price;
                    document.getElementById('purchase-id').value = data.sale_id;
                    document.getElementById('bill-no').value = data.bill_no || '';
                    document.getElementById('buyer-name').disabled = true;
                    document.getElementById('edit-form').style.display = 'block';
                })
                .catch(err => console.error('Error fetching purchase data:', err));
        }

        // Handle Delete Button
        if (target && target.classList.contains('delete-btn')) {
            const id = target.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this record?')) {
                // Call backend to delete the sale
                fetch(`/purchase-record/delete/${id}`, {
                    method: 'DELETE',
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            alert('Purchase record deleted successfully');
                            // Re-fetch the purchase data to update the table
                            fetchPurchases(); // This will update the table with the latest data
                        } else {
                            alert('Failed to delete purchase record');
                        }
                    })
                    .catch(error => {
                        console.error('Error deleting purchase record:', error);
                    });
            }
        }
    });

    // Recalculate the Price and Unpaid Amount when any of the fields change
    document.getElementById('quantity').addEventListener('input', updatePriceAndUnpaidAmount);
    document.getElementById('rate').addEventListener('input', updatePriceAndUnpaidAmount);
    document.getElementById('paid-amount').addEventListener('input', updateUnpaidAmount);

    // Price and Unpaid Amount Calculation
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

// Event listener for the Buyer Search Box
document.getElementById('buyer-search-box').addEventListener('input', function () {
    const searchValue = this.value.toLowerCase();
    const buyerFilter = document.getElementById('buyer-filter');
    
    // Filter the buyer dropdown based on the search value
    for (let i = 0; i < buyerFilter.options.length; i++) {
        const option = buyerFilter.options[i];
        const buyerName = option.text.toLowerCase();
        
        // Show or hide options based on the search value (case-insensitive)
        if (buyerName.includes(searchValue)) {
            option.style.display = 'block';
        } else {
            option.style.display = 'none';
        }
    }

    // Filter the table rows based on the Buyer search box input
    filterTableRows();
});

// Event listener for the Container Search Box
document.getElementById('container-search-box').addEventListener('input', function () {
    const searchValue = this.value.toLowerCase();
    const containerFilter = document.getElementById('container-filter');
    
    // Filter the container dropdown based on the search value
    for (let i = 0; i < containerFilter.options.length; i++) {
        const option = containerFilter.options[i];
        const containerNumber = option.text.toLowerCase();
        
        // Show or hide options based on the search value (case-insensitive)
        if (containerNumber.includes(searchValue)) {
            option.style.display = 'block';
        } else {
            option.style.display = 'none';
        }
    }

    // Filter the table rows based on the Container search box input
    filterTableRows();
});

// Function to filter table rows based on Buyer and Container search values
function filterTableRows() {
    const buyerSearchValue = document.getElementById('buyer-search-box').value.toLowerCase();
    const containerSearchValue = document.getElementById('container-search-box').value.toLowerCase();
    
    const tableRows = document.querySelectorAll('#purchase-table tbody tr');
    
    tableRows.forEach(row => {
        const buyerCell = row.querySelector('td:nth-child(3)').textContent.toLowerCase();
        const containerCell = row.querySelector('td:nth-child(4)').textContent.toLowerCase();
        
        // Check if both Buyer and Container values match the search criteria
        const buyerMatches = buyerCell.includes(buyerSearchValue);
        const containerMatches = containerCell.includes(containerSearchValue);
        
        // Show or hide the row based on search criteria
        if (buyerMatches && containerMatches) {
            row.style.display = '';  // Show row
        } else {
            row.style.display = 'none';  // Hide row
        }
    });
}



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

    const buyerDropdown = document.getElementById('buyer-filter');
    const selectedBuyerId = buyerDropdown.value;
    const buyerName = buyerDropdown.selectedOptions[0]
        ? buyerDropdown.selectedOptions[0].text
        : "All Buyers";

    const sanitizedBuyerName = buyerName.replace(/\s+/g, "_");

    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).replace(/\//g, "-");

    let formattedTime = currentDate.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    formattedTime = formattedTime.replace(/[:\s]/g, "-").toUpperCase();

    const fileName = `Sales_History_${sanitizedBuyerName}_${formattedDate}_${formattedTime}.pdf`;

    let buyerLocation = '';
    if (selectedBuyerId !== "0") {
        fetch(`/buyers/location/${selectedBuyerId}`)
            .then(r => r.json())
            .then(data => {
                buyerLocation = data.location || '';
                generatePDF(doc, buyerName, buyerLocation, formattedDate, fileName);
            })
            .catch(err => {
                console.error('Error fetching buyer location:', err);
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
    let startY = headerBarHeight + 30;
    let firstPage = true;

    const watermarkImg = new Image();
    watermarkImg.src = "/public/watermark.png";

    watermarkImg.onload = function () {
        // header + watermark (on every page)
        function drawHeaderAndWatermark(pageNumber) {
            // watermark
            doc.setGState(new doc.GState({ opacity: 0.2 }));
            const watermarkX = pageWidth / 4;
            const watermarkY = pageHeight / 3;
            const watermarkWidth = pageWidth / 2;
            const watermarkHeight = pageHeight / 4;
            doc.addImage(watermarkImg, 'PNG', watermarkX, watermarkY, watermarkWidth, watermarkHeight);
            doc.setGState(new doc.GState({ opacity: 1 }));

            // header bar
            doc.setFillColor(49, 178, 230);
            doc.rect(0, 0, pageWidth, headerBarHeight, 'F');
            try {
                doc.addImage('/public/lsg.png', 'PNG', 14, 5, 30, 10);
            } catch (e) {}
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 255, 255);
            doc.text("Sales History", pageWidth - 50, 11);

            // invoice to + date only on first page
            if (pageNumber === 1) {
                const invoiceYPosition = 30;
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                doc.text("INVOICE TO:", 14, invoiceYPosition);
                doc.setFont("helvetica", "normal");
                doc.text(buyerName, 14, invoiceYPosition + 5);
                if (buyerLocation) {
                    doc.text(buyerLocation, 14, invoiceYPosition + 10);
                }

                const dateLabel = "DATE:";
                const dateText = `${formattedDate}`;
                const dateLabelWidth = doc.getTextWidth(dateLabel);
                const xPosition = pageWidth - dateLabelWidth - 40;
                doc.setFont("helvetica", "bold");
                doc.text(dateLabel, xPosition, invoiceYPosition);
                doc.setFont("helvetica", "normal");
                doc.text(dateText, xPosition, invoiceYPosition + 5);
            }
        }

        // table
        const table = document.getElementById('purchase-table');

        doc.autoTable({
            html: table,
            theme: 'grid',
            startY: startY,
            margin: { horizontal: 10, top: 20, bottom: 40 },
            headStyles: {
                fillColor: [0, 0, 0],
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: 'bold'
            },
            bodyStyles: {
                fontSize: 8,
                textColor: [0, 0, 0]
            },
            footStyles: {
                fillColor: [220, 220, 220],
                textColor: [0, 0, 0],
                fontSize: 8,
                fontStyle: 'bold'
            },
            pageBreak: 'auto',
            showHead: 'everyPage',
            showFoot: 'lastPage',
            didDrawPage: function (data) {
                // only header + watermark here
                drawHeaderAndWatermark(data.pageNumber);
                if (data.pageNumber > 1) {
                    startY = data.cursor + 30;
                }
            }
        });

        // footer: draw ONLY on last page
        const totalPages = doc.internal.getNumberOfPages();
        doc.setPage(totalPages);

        const line1 = "Thank You For Your Business";
        const line2 = "Generated by bYTE Ltd.";
        const line3 = "For inquiries, contact support@lsgroup.com.bd";

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(line1, (pageWidth - doc.getTextWidth(line1)) / 2, pageHeight - 30);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(line2, (pageWidth - doc.getTextWidth(line2)) / 2, pageHeight - 20);
        doc.text(line3, (pageWidth - doc.getTextWidth(line3)) / 2, pageHeight - 15);

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
