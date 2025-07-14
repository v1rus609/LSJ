document.addEventListener('DOMContentLoaded', function () {
    const discountList = document.getElementById('discount-list');
    const buyerSearchBox = document.getElementById('buyer-search-box');
    const exportExcelButton = document.getElementById('export-btn');
    const exportPdfButton = document.getElementById('export-pdf-btn');
    
    let discountData = [];

    // Fetch discount data from the backend
    fetch('/discounts/list')
        .then(response => response.json())
        .then(data => {
            discountData = data;
            renderTable(discountData);  // Render the table with all discounts
        })
        .catch(error => {
            console.error('Error fetching discount data:', error);
            document.getElementById('error-message').style.display = 'block'; // Show error message if data fetch fails
        });

    // Function to render the discount table
    function renderTable(data) {
        if (!data || data.length === 0) {
            discountList.innerHTML = '<tr><td colspan="5">No discounts available.</td></tr>';
            return;
        }

        discountList.innerHTML = ''; // Clear the existing rows
        data.forEach((discount, index) => {
            const formattedDate = formatDate(discount.date); // Format the date

            const row = `
                <tr data-id="${discount.id}">
                    <td>${index + 1}</td>
                    <td>${formattedDate}</td> <!-- Display the formatted date -->
                    <td>${discount.buyer_name}</td>
                    <td>
                        <span class="discount-display">${formatNumberWithCommas(discount.discount_amount)}</span>
                        <input class="discount-input" type="number" value="${discount.discount_amount}" style="display: none;" />
                    </td>
                    <td>
                        <button class="edit-btn" data-id="${discount.id}">Edit</button>
                        <button class="delete-btn" data-id="${discount.id}">Delete</button>
                    </td>
                </tr>
            `;
            discountList.innerHTML += row;
        });

        // Add event listeners for "Edit" and "Delete" buttons
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', handleEditDiscount);
        });

        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', handleDeleteDiscount);
        });
    }

    // Helper function to format numbers with commas
    function formatNumberWithCommas(number) {
        return parseFloat(number).toLocaleString('en-US');
    }

    // Function to format date in dd/mm/yyyy format
    function formatDate(date) {
        const d = new Date(date);
        const day = ('0' + d.getDate()).slice(-2);
        const month = ('0' + (d.getMonth() + 1)).slice(-2);
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }

    // Export to Excel functionality
    exportExcelButton.addEventListener('click', function () {
        const table = document.querySelector('table'); // Get the table
        const workbook = XLSX.utils.table_to_book(table, { sheet: "Discount List" });
        XLSX.writeFile(workbook, 'Discount_List.xlsx');
    });

    // Export to PDF functionality
    exportPdfButton.addEventListener('click', function () {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

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
        const fileName = `Discount_List_${formattedDate}_${formattedTime}.pdf`;

        // Proceed to generate the PDF without including the buyer's name or location
        generatePDF(doc, formattedDate, fileName);
    });

    function generatePDF(doc, formattedDate, fileName) {
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const headerBarHeight = 18;
        let startY = headerBarHeight + 10;
        let firstPage = true;

            // Load watermark image
    const watermarkImg = new Image();
    watermarkImg.src = "/public/watermark.png";

    watermarkImg.onload = function () {
        function addHeaderAndFooterAndWatermark(doc, pageNumber) {
            // --- Watermark (on every page) ---
            const watermarkX = pageWidth / 4;
            const watermarkY = pageHeight / 3;
            const watermarkWidth = pageWidth / 2;
            const watermarkHeight = pageHeight / 4;

            // Add watermark image (scaled to fit in the page)
            doc.setGState(new doc.GState({ opacity: 0.2 })); // Faint watermark
            doc.addImage(watermarkImg, 'PNG', watermarkX, watermarkY, watermarkWidth, watermarkHeight);
            doc.setGState(new doc.GState({ opacity: 1 })); // Reset opacity for normal content

            // --- Header ---
            doc.setFillColor(49, 178, 230);
            doc.rect(0, 0, pageWidth, headerBarHeight, 'F');
            doc.addImage('/public/lsg.png', 'PNG', 14, 5, 30, 10);
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 255, 255);
            doc.text("Discount List", pageWidth - 50, 11);

            if (firstPage) {
                const dateLabel = "Date:";
                const dateText = formattedDate;
                const dateLabelWidth = doc.getTextWidth(dateLabel);
                const xPosition = pageWidth - dateLabelWidth - 40;
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                doc.setFont("helvetica", "bold");
                doc.text(dateLabel, xPosition, 25);
                doc.setFont("helvetica", "normal");
                doc.text(dateText, xPosition + dateLabelWidth + 5, 25);
                firstPage = false;
            }

            // --- Footer ---
            const line1 = "Thank You For Your Business";
            const line2 = "Generated by bYTE Ltd.";
            const line3 = "For inquiries, contact support@lsgroup.com.bd";

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0);

            const line1Width = doc.getTextWidth(line1);
            const line2Width = doc.getTextWidth(line2);
            const line3Width = doc.getTextWidth(line3);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text(line1, (pageWidth - line1Width) / 2.3, pageHeight - 30);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.text(line2, (pageWidth - line2Width) / 2, pageHeight - 20);
            doc.text(line3, (pageWidth - line3Width) / 2, pageHeight - 15);
        }

        // --- Table Section ---
        const table = document.getElementById('discount-list');
        const rows = table.querySelectorAll('tr');

        const tableRows = [];
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 4) {
                const rowData = [
                    cells[0].innerText.trim(), // ID
                    cells[1].innerText.trim(), // Date
                    cells[2].innerText.trim(), // Buyer Name
                    cells[3].innerText.trim()  // Discount Amount
                ];
                tableRows.push(rowData);
            }
        });

        const options = {
            head: [['ID', 'Date', 'Buyer Name', 'Discount Amount']],
            body: tableRows,
            theme: 'grid',
            startY: startY,
            margin: { horizontal: 10, top: 20, bottom: 40 },
            headStyles: {
                fillColor: [0, 0, 0],
                textColor: [255, 255, 255],
                fontSize: 8,
                fontStyle: 'bold',
            },
            bodyStyles: {
                fontSize: 8,
                textColor: [0, 0, 0],
            },
            pageBreak: 'auto',
            showHead: 'everyPage',
            didDrawPage: function (data) {
                if (data.pageNumber > 1) {
                    startY = data.cursor + 30;
                }
                addHeaderAndFooterAndWatermark(doc, data.pageNumber);
            },
        };

        doc.autoTable(options);
        doc.save(fileName);
    };

    watermarkImg.onerror = function () {
        console.error('Error loading watermark image.');
    };
}

    // Function to handle the Edit button click
    function handleEditDiscount(event) {
        const discountId = event.target.dataset.id; // Get the discountId from the button's data-id
        const discountRow = event.target.closest('tr');
        const discountInput = discountRow.querySelector('.discount-input');
        const discountDisplay = discountRow.querySelector('.discount-display');

        // Show input and hide the display
        discountInput.style.display = 'inline';
        discountDisplay.style.display = 'none';
        discountInput.focus();

        // When the user leaves the input field, update the discount
        discountInput.addEventListener('blur', function () {
            const newDiscountAmount = parseFloat(discountInput.value);

            if (newDiscountAmount !== parseFloat(discountDisplay.textContent.replace(/,/g, ''))) {
                // Make the request to update the discount
                fetch(`/discounts/edit/${discountId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ discount_amount: newDiscountAmount }),
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Discount updated successfully');
                        discountDisplay.textContent = formatNumberWithCommas(newDiscountAmount); // Update the displayed discount amount
                        discountInput.style.display = 'none';
                        discountDisplay.style.display = 'inline';
                    } else {
                        alert('Failed to update discount');
                    }
                })
                .catch(error => {
                    console.error('Error updating discount:', error);
                    alert('Failed to update discount');
                });
            } else {
                // If no change, hide input and show display
                discountInput.style.display = 'none';
                discountDisplay.style.display = 'inline';
            }
        });
    }

    // Function to handle the Delete button click
    function handleDeleteDiscount(event) {
        const discountId = event.target.dataset.id;

        if (confirm('Are you sure you want to delete this discount?')) {
            fetch(`/discounts/delete/${discountId}`, {
                method: 'DELETE',
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Discount deleted successfully');
                        // Re-fetch the discount list after deletion
                        fetch('/discounts/list')
                            .then(response => response.json())
                            .then(data => {
                                discountData = data;
                                renderTable(discountData); // Re-render table
                            });
                    } else {
                        alert('Failed to delete discount');
                    }
                })
                .catch(error => {
                    console.error('Error deleting discount:', error);
                    alert('Failed to delete discount');
                });
        }
    }

    // Buyer search functionality
    buyerSearchBox.addEventListener('input', function () {
        const searchValue = buyerSearchBox.value.toLowerCase();
        
        // Filter the discount data based on the buyer's name
        const filteredData = discountData.filter(discount => {
            return discount.buyer_name.toLowerCase().includes(searchValue);
        });

        // Render the table with filtered data
        renderTable(filteredData);
    });
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
