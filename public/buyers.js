let buyerData = []; // Store fetched buyer data for filtering

// Function for displaying numbers in the table (Fixed decimal places)
function formatTableNumber(value) {
    if (value === null || value === undefined || value === '') {
        return '0.00'; // Default display value
    }

    const num = parseFloat(value.toString().replace(/,/g, '')); // Remove commas before parsing
    if (isNaN(num)) return value; // Return original value if not a number

    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Fetch buyers and populate the table
fetch('/buyers/list')
    .then(response => {
        if (!response.ok) throw new Error('Failed to fetch buyer data.');
        return response.json();
    })
    .then(data => {
        buyerData = data;
        renderTable(buyerData);
    })
    .catch(error => {
        console.error('❌ Error fetching buyers:', error);
        document.getElementById('error-message').style.display = 'block';
    });

// ✅ **Render Table with Fixed Decimal Formatting**
function renderTable(data) {
    const tableBody = document.getElementById('buyer-list');
    tableBody.innerHTML = ''; // Clear the existing table rows

data.forEach((buyer, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${index + 1}</td>
        <td>
            <span class="name-display" data-id="${buyer.id}">${buyer.name}</span>
            <input class="name-input" type="text" value="${buyer.name}" data-id="${buyer.id}" style="display: none;" />
        </td>
        <td>
            <span class="location-display" data-id="${buyer.id}">${buyer.location}</span>
            <input class="location-input" type="text" value="${buyer.location}" data-id="${buyer.id}" style="display: none;" />
        </td>
        <td>
            <span class="contact-display" data-id="${buyer.id}">${buyer.contact_number}</span>
            <input class="contact-input" type="text" value="${buyer.contact_number}" data-id="${buyer.id}" style="display: none;" />
        </td>
        <td>
            <span class="balance-display" data-id="${buyer.id}">${formatTableNumber(buyer.opening_balance)}</span>
            <input class="balance-input" type="text" value="${buyer.opening_balance}" data-id="${buyer.id}" style="display: none;" />
        </td>
        <td class="action-column">
            <button class="edit-btn" data-id="${buyer.id}">Edit</button>
            <button class="delete-btn" onclick="deleteBuyer(${buyer.id})"><span class="delete-text">Delete</span><i class="fas fa-trash-alt"></i></button>
        </td>
    `;
    tableBody.appendChild(row);
});


    // Add event listeners for "Edit" buttons dynamically after the table is rendered
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', handleEditBuyer);
    });

    if (!window.isAdmin) {
        document.querySelectorAll('.action-column').forEach(cell => cell.style.display = 'none');
    }
}


function handleEditBuyer(event) {
    const buyerId = parseInt(event.target.dataset.id); // Convert the ID to a number

    // Find the buyer by ID from buyerData
    const buyer = buyerData.find(b => b.id === buyerId);

    if (!buyer) {
        console.error('Buyer not found!');
        alert('Buyer not found!');
        return;
    }

    // Select the display and input elements for each field
    const nameDisplay = document.querySelector(`.name-display[data-id="${buyerId}"]`);
    const nameInput = document.querySelector(`.name-input[data-id="${buyerId}"]`);

    const locationDisplay = document.querySelector(`.location-display[data-id="${buyerId}"]`);
    const locationInput = document.querySelector(`.location-input[data-id="${buyerId}"]`);

    const contactDisplay = document.querySelector(`.contact-display[data-id="${buyerId}"]`);
    const contactInput = document.querySelector(`.contact-input[data-id="${buyerId}"]`);

    const balanceDisplay = document.querySelector(`.balance-display[data-id="${buyerId}"]`);
    const balanceInput = document.querySelector(`.balance-input[data-id="${buyerId}"]`);

    // Show the input fields and hide the display spans for the current row
    nameInput.style.display = 'inline';
    locationInput.style.display = 'inline';
    contactInput.style.display = 'inline';
    balanceInput.style.display = 'inline';

    nameDisplay.style.display = 'none';
    locationDisplay.style.display = 'none';
    contactDisplay.style.display = 'none';
    balanceDisplay.style.display = 'none';

    // Change the Edit button to Save button
    const editButton = document.querySelector(`.edit-btn[data-id="${buyerId}"]`);

    if (editButton) {
        editButton.innerHTML = "Save";
        editButton.classList.remove("edit-btn");
        editButton.classList.add("save-btn");

        // Add event listener to the Save button to save changes
        editButton.addEventListener('click', function saveChanges() {
            const newName = nameInput.value;
            const newLocation = locationInput.value;
            const newContact = contactInput.value;
            const newBalance = parseFloat(balanceInput.value.replace(/,/g, ''));

            buyer.name = newName;
            buyer.location = newLocation;
            buyer.contact_number = newContact;
            buyer.opening_balance = newBalance;

            // Update the buyer data in the backend
            fetch(`/buyers/update/${buyerId}`, {
                method: 'POST',
                body: JSON.stringify({
                    name: newName,
                    location: newLocation,
                    contact_number: newContact,
                    opening_balance: newBalance
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Buyer updated successfully!');
                    renderTable(buyerData); // Re-render the table after successful update
                } else {
                    alert('Failed to update buyer!');
                }
            })
            .catch(error => {
                console.error('Error updating buyer:', error);
                alert('Failed to update buyer.');
            });

            // Change the Save button back to Edit button after saving
            editButton.innerHTML = "Edit";
            editButton.classList.remove("save-btn");
            editButton.classList.add("edit-btn");

            // Hide the input fields and show the display spans again
            nameInput.style.display = 'none';
            locationInput.style.display = 'none';
            contactInput.style.display = 'none';
            balanceInput.style.display = 'none';

            nameDisplay.style.display = 'inline';
            locationDisplay.style.display = 'inline';
            contactDisplay.style.display = 'inline';
            balanceDisplay.style.display = 'inline';
        });
    } else {
        console.error("Edit button not found for buyer:", buyerId);
    }
}

// Delete a buyer
function deleteBuyer(buyerId) {
    if (confirm('Are you sure you want to delete this buyer?')) {
        fetch(`/buyers/delete/${buyerId}`, { method: 'DELETE' })
            .then(response => {
                if (!response.ok) throw new Error(`Failed to delete buyer. Status: ${response.status}`);
                return response.text();
            })
            .then(message => {
                alert(message);
                location.reload();
            })
            .catch(error => {
                console.error('❌ Error deleting buyer:', error);
                alert('Failed to delete buyer. Please try again.');
            });
    }
}

// Filter buyers based on search input
document.getElementById('search-box').addEventListener('input', function () {
    const searchValue = this.value.toLowerCase();
    const filteredData = buyerData.filter(buyer =>
        buyer.name.toLowerCase().includes(searchValue) ||
        buyer.location.toLowerCase().includes(searchValue)
    );
    renderTable(filteredData);
});

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

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

    // Generate filename without buyer details
    const fileName = `Buyer_List_${formattedDate}_${formattedTime}.pdf`;

    // Proceed to generate the PDF without including the delete button
    generatePDF(doc, formattedDate, fileName);
}

function generatePDF(doc, formattedDate, fileName) {
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const headerBarHeight = 18;
    let startY = headerBarHeight + 10; // Default starting position for the first page
    let firstPage = true;  // Flag to track if we are on the first page

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
            doc.text("Buyer List", pageWidth - 50, 11); // Header title

            // --- Date Section: Display Date: 22-04-25 on the first page only ---
            if (firstPage) {
                const dateLabel = "Date:";
                const dateText = `${formattedDate}`;
                const dateLabelWidth = doc.getTextWidth(dateLabel); // Width of "Date:" label
                const xPosition = pageWidth - dateLabelWidth - 40; // Right-align "Date:" label
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                doc.setFont("helvetica", "bold");
                doc.text(dateLabel, xPosition, 25); // Positioning "Date:" label
                doc.setFont("helvetica", "normal");
                doc.text(dateText, xPosition + dateLabelWidth + 5, 25)
                firstPage = false; // After the first page, set this flag to false
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
        const table = document.getElementById('buyer-list');  // The table ID you are exporting
        const rows = table.querySelectorAll('tbody tr'); // Select rows in the table

        // Prepare rows data excluding delete buttons
        const tableRows = [];
        rows.forEach(row => {
            const rowData = [];
            const cells = row.querySelectorAll('td');
            // Exclude the delete button (last cell)
            for (let i = 0; i < cells.length - 1; i++) {
                rowData.push(cells[i].innerText.trim()); // Push each cell's content except the delete button
            }
            tableRows.push(rowData);
        });

        // Define options for jsPDF autoTable
        const options = {
            body: tableRows,
            head: [['ID', 'Name', 'Location', 'Contact Number', 'Opening Balance']], // Table Header
            theme: 'grid',
            startY: startY,  // Start position for the table content
            margin: { horizontal: 10, top: 20, bottom: 40 },
            headStyles: {
                fillColor: [0, 0, 0], // Table header color (black)
                textColor: [255, 255, 255], // Table header text color (white)
                fontSize: 8,  // Font size for headers
                fontStyle: 'bold',  // Make header text bold
            },
            bodyStyles: {
                fontSize: 8,  // Font size for table content
                textColor: [0, 0, 0],  // Table content text color (black)
            },
            footStyles: {
                fillColor: [220, 220, 220],  // Footer background color
                textColor: [0, 0, 0],  // Footer text color (black)
                fontSize: 10,  // Font size for footer
                fontStyle: 'bold',  // Make footer text bold
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
// Export to Excel function
function exportToExcel() {
    const table = document.getElementById('buyer-list');  // Table element (make sure this ID is correct)
    const workbook = XLSX.utils.table_to_book(table, { sheet: "Buyer List" });  // Convert table to workbook
    XLSX.writeFile(workbook, 'Buyer_List.xlsx');  // Download the Excel file
}


// ✅ **Opening Balance Input Field: Add Separate Formatting**
document.addEventListener('DOMContentLoaded', function () {
    const openingBalanceInput = document.getElementById('opening-balance');

    if (openingBalanceInput) {
        openingBalanceInput.addEventListener('input', function () {
            this.value = formatInputNumber(this.value); // Format with commas dynamically
        });

        openingBalanceInput.addEventListener('focus', function () {
            this.value = getRawNumber(this.value); // Remove commas while editing
        });

        openingBalanceInput.addEventListener('blur', function () {
            this.value = formatInputNumber(this.value); // Re-add commas when leaving the field
        });
    }

    // ✅ **Ensure correct format before submitting the form**
    const buyerForm = document.querySelector('form');
    if (buyerForm) {
        buyerForm.addEventListener('submit', function () {
            openingBalanceInput.value = getRawNumber(openingBalanceInput.value); // Send raw number
        });
    }
	
});

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

// ✅ **Handle dropdown visibility**
document.addEventListener("DOMContentLoaded", function () {
    const dropdownButton = document.querySelector(".dropbtn");
    const dropdownContent = document.querySelector(".dropdown-content");

    dropdownButton.addEventListener("click", function (event) {
        event.stopPropagation();
        dropdownContent.style.display = dropdownContent.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", function () {
        dropdownContent.style.display = "none";
    });
});
