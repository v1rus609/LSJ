// Global scope for variables and functions that need to be accessed outside of DOMContentLoaded
let buyerFilter, containerFilter, startDateInput, endDateInput, tableBody, totalRow;

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

function fetchContainers(buyerId = null) {
    containerFilter.innerHTML = '<option value="0">Select Container</option>';

    let url = buyerId && buyerId !== "0" ? `/get-containers-by-buyer?id=${buyerId}` : '/get-all-containers';

    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log('Data fetched for containers:', data); // Log the data to inspect the response
            if (Array.isArray(data)) {
                data.forEach(container => {
                    const option = document.createElement('option');
                    option.value = container.id;
                    option.textContent = container.container_number;
                    containerFilter.appendChild(option);
                });
            } else {
                console.error('Expected an array but received:', data);
            }
        })
        .catch(error => {
            console.error('Error fetching containers:', error);
        });
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

            let actionCell = '';
            if (window.isAdmin) {
                actionCell = `
                    <td>
                        <button class="edit-btn" data-id="${returnRecord.id}"><span class="edit-text">Edit</span><i class="fas fa-edit"></i></button>
                        <button class="delete-btn" data-id="${returnRecord.id}"><span class="delete-text">Delete</span><i class="fas fa-trash-alt"></i></button>
                    </td>
                `;
            }

            row.innerHTML = ` 
                <td>${index + 1}</td>
                <td>${returnRecord.buyer_name}</td>
                <td>${returnRecord.container_number}</td>
                <td>${formatDate(returnRecord.return_date)}</td>
                <td>${formatNumberWithCommas(returnRecord.returned_kg)}</td>
                <td>${formatNumberWithCommas(returnRecord.returned_price_per_kg)}</td>
                <td>${formatNumberWithCommas(returnRecord.total_amount)}</td>
                ${actionCell}
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


// ✅ Fetch role before doing anything
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
    });

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

document.addEventListener('DOMContentLoaded', function () {
    // Initialize DOM elements
    buyerFilter = document.getElementById('buyer-filter');
    containerFilter = document.getElementById('container-filter');
    startDateInput = document.getElementById('start-date');
    endDateInput = document.getElementById('end-date');
    tableBody = document.getElementById('return-history-table').querySelector('tbody');
    totalRow = document.getElementById('total-row'); // Total row for Returned KG and Total Amount

    // ✅ Initial fetch when the page loads
    fetchBuyers();
    fetchContainers();
    fetchReturnHistory();

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
});

// Handle Delete button functionality
document.addEventListener('click', function (event) {
    let target = event.target;

    // Ensure we always target the button (even if clicking on the icon inside it)
    if (target.tagName === 'I') {
        target = target.closest('button');
    }

    if (target && target.classList.contains('delete-btn')) {
        const id = target.getAttribute('data-id');
        console.log('Deleting return record with ID:', id); // Log the ID to check if it's undefined

        if (!id) {
            console.error("ID is missing for the delete button.");
            return; // Prevent the request from being sent if ID is missing
        }

        // Show confirmation dialog before proceeding with deletion
        const confirmed = confirm('Are you sure you want to delete this return record?');
        if (!confirmed) {
            return; // If not confirmed, stop the delete process
        }

        // Proceed with the delete request
        fetch(`/purchase-return/delete/${id}`, { method: 'DELETE' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Return record deleted successfully');
                    fetchReturnHistory(); // Refresh the return history after deletion
                } else {
                    alert('Failed to delete return record');
                }
            })
            .catch(error => console.error('Error deleting return record:', error));
    }
});


		
// Handle Edit button functionality
document.addEventListener('click', function (event) {
    let target = event.target;

    // Ensure we always target the button (even if clicking on the icon inside it)
    if (target.tagName === 'I') {
        target = target.closest('button');
    }

    if (target && target.classList.contains('edit-btn')) {
        const id = target.getAttribute('data-id'); // Get the correct ID
        
        if (!id) {
            console.error("ID is missing for the edit button.");
            return; // Prevent proceeding if ID is missing
        }

        // Fetch return record by ID and populate the edit form
        fetch(`/purchase-return/${id}`)
            .then(response => response.json())
            .then(data => {
                if (!data) {
                    alert('Error: Return record not found.');
                    return;
                }

                // Populate form fields
                document.getElementById('return-id').value = data.id;
                document.getElementById('return-date').value = data.return_date; // Set return date
                document.getElementById('returned-kg').value = data.returned_kg;  // Set returned kg
                document.getElementById('returned-price-per-kg').value = data.returned_price_per_kg;  // Set returned price per kg
                document.getElementById('total-amount').value = data.total_amount;  // Set total amount

                // Set the buyer name (for display only)
                document.getElementById('buyer-name').value = data.buyer_name;  

                // Set the container number (for display only)
                document.getElementById('container-name').value = data.container_number;  
                
                // Show the modal for editing
                document.getElementById('edit-return-form').style.display = 'block';
            })
            .catch(error => {
                console.error('Error fetching return record:', error);
                alert('Failed to fetch return details.');
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
    const fileName = `Return_History_${sanitizedBuyerName}_${formattedDate}_${formattedTime}.pdf`;

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

function generatePDF(doc, buyerName, buyerLocation, formattedDate, fileName) {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const headerBarHeight = 18;
  let startY = headerBarHeight + 30;

  const watermarkImg = new Image();
  watermarkImg.src = "/public/watermark.png";

  watermarkImg.onload = function () {

    // header + watermark only
    function drawHeader(pageNumber) {
      // watermark
      doc.setGState(new doc.GState({ opacity: 0.2 }));
      const wx = pageWidth / 4;
      const wy = pageHeight / 3;
      const ww = pageWidth / 2;
      const wh = pageHeight / 4;
      doc.addImage(watermarkImg, "PNG", wx, wy, ww, wh);
      doc.setGState(new doc.GState({ opacity: 1 }));

      // header bar
      doc.setFillColor(49, 178, 230);
      doc.rect(0, 0, pageWidth, headerBarHeight, "F");

      try {
        doc.addImage("/public/lsg.png", "PNG", 14, 5, 30, 10);
      } catch (e) {
        // ignore if logo missing
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("Return History", pageWidth - 50, 11);

      // invoice block only on first page
      if (pageNumber === 1) {
        const y = 30;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text("INVOICE TO:", 14, y);
        doc.setFont("helvetica", "normal");
        doc.text(buyerName, 14, y + 5);

        if (buyerLocation) {
          doc.text(buyerLocation, 14, y + 10);
        }

        const dateLabel = "DATE:";
        const dateText = `${formattedDate}`;
        const labelW = doc.getTextWidth(dateLabel);
        const x = pageWidth - labelW - 40;
        doc.setFont("helvetica", "bold");
        doc.text(dateLabel, x, y);
        doc.setFont("helvetica", "normal");
        doc.text(dateText, x, y + 5);
      }
    }

    // ---- TABLE ----
    const table = document.getElementById("return-history-table");

    doc.autoTable({
      html: table,
      theme: "grid",
      startY: startY,
      margin: { horizontal: 10, top: 20, bottom: 40 },
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0],
      },
      footStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontSize: 8,
        fontStyle: "bold",
      },
      pageBreak: "auto",
      showHead: "everyPage",
      showFoot: "lastPage",
      didDrawPage: function (data) {
        drawHeader(data.pageNumber);
        if (data.pageNumber > 1) {
          startY = data.cursor + 30;
        }
      },
    });

    // ✅ footer ONLY on last page
    const totalPages = doc.internal.getNumberOfPages();
    doc.setPage(totalPages);

    const line1 = "Thank You For Your Business";
    const line2 = "Generated by bYTE Ltd.";
    const line3 = "For inquiries, contact support@lsgroup.com.bd";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(
      line1,
      (pageWidth - doc.getTextWidth(line1)) / 2.3,
      pageHeight - 30
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      line2,
      (pageWidth - doc.getTextWidth(line2)) / 2,
      pageHeight - 20
    );
    doc.text(
      line3,
      (pageWidth - doc.getTextWidth(line3)) / 2,
      pageHeight - 15
    );

    doc.save(fileName);
  };
}


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