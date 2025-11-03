document.addEventListener("DOMContentLoaded", function () {
    const buyerDropdown = document.getElementById("buyer-dropdown");
    const buyerSearchBox = document.getElementById("buyer-search-box");
    const tableBody = document.getElementById("timeline-table").querySelector("tbody");

    // Fetch buyers for dropdown
    fetch("/buyers/list")
        .then(response => response.json())
        .then(data => {
            // Add a default "Select Buyer" option
            const defaultOption = document.createElement("option");
            defaultOption.value = "";
            defaultOption.textContent = "Select Buyer";
            defaultOption.disabled = true;
            defaultOption.selected = true;
            buyerDropdown.appendChild(defaultOption);

            // Populate buyers
            data.forEach(buyer => {
                const option = document.createElement("option");
                option.value = buyer.id;
                option.textContent = buyer.name;
                buyerDropdown.appendChild(option);
            });

            // Add event listener for search box to filter buyer options
            buyerSearchBox.addEventListener("input", function () {
                const searchValue = buyerSearchBox.value.toLowerCase();
                // Loop through all buyer dropdown options
                for (let i = 0; i < buyerDropdown.options.length; i++) {
                    const option = buyerDropdown.options[i];
                    const buyerName = option.text.toLowerCase();

                    // If the buyer name includes the search value, show the option; otherwise, hide it
                    if (buyerName.includes(searchValue)) {
                        option.style.display = "block";
                    } else {
                        option.style.display = "none";
                    }
                }
            });
        });

    // Fetch opening balance and timeline for the selected buyer
    buyerDropdown.addEventListener("change", function () {
        const buyerId = buyerDropdown.value;
        if (!buyerId) return;

        // Fetch opening balance for the selected buyer
        fetch(`/buyers/opening-balance/${buyerId}`)
            .then(response => response.json())
            .then(data => {
                const openingBalance = data.opening_balance || 0;

                // Fetch buyer timeline data (including discounts)
                fetch(`/buyer-timeline?buyer_id=${buyerId}`)
                    .then(response => response.json())
                    .then(data => {
                        tableBody.innerHTML = ""; // Clear previous data

                        let totalCash = 0;
                        let totalBank = 0;
                        let totalNonCash = 0;
                        let totalDiscount = 0;
                        let totalBill = openingBalance; // Start with opening balance as initial totalBill
                        let runningTotalTaka = openingBalance; // Initialize running total with opening balance
                        let totalQuantity = 0; // Initialize total quantity

                        // Add Opening Balance as the first row
                        const openingBalanceRow = `<tr>
                            <td>-</td>
                            <td>Opening Balance</td>
                            <td>-</td>
                            <td>-</td>
                            <td>-</td>
                            <td>-</td>
                            <td>-</td>
                            <td>-</td>
                            <td>-</td>
                            <td>-</td>
                            <td>${openingBalance.toLocaleString()}</td>
                            <td>${runningTotalTaka.toLocaleString()}</td>
                        </tr>`;
                        tableBody.innerHTML += openingBalanceRow;

                        // Loop through timeline data and add rows
                        data.timeline.forEach(entry => {
                            const cash = parseFloat(entry.cash) || 0;
                            const bank = parseFloat(entry.bank) || 0;
                            const nonCash = parseFloat(entry.non_cash) || 0;
                            const billAmount = parseFloat(entry.bill_amount) || 0;
                            const discount = parseFloat(entry.discount_amount) || 0;
                            const totalTakaValue = parseFloat(entry.total_taka) || 0;
                            const quantity = parseFloat(entry.quantity) || 0;

                            // Sum up totals (except Total Taka)
                            totalCash += cash;
                            totalBank += bank;
                            totalNonCash += nonCash;
                            totalDiscount += discount; // Add discount to total discount
                            totalQuantity += quantity; // Add quantity to total

                            // Only add the purchase amount to the totalBill, excluding returns and payments
                            if (entry.type === "Purchase") {
                                totalBill += billAmount;
                            }

                            // Update running total of Taka for this entry
                            runningTotalTaka += billAmount; // Add purchase bill amount to runningTotalTaka
                            runningTotalTaka -= (cash + bank + nonCash + discount); // Deduct payments, returns, and discount from running total

                            // Add row to the table
                            const row = `<tr>
                                <td>${entry.date}</td>
                                <td>${entry.type || '-'}</td>
                                <td>${entry.bill_no || '-'}</td>
                                <td>${entry.details || '-'}</td>
                                <td>${quantity || '-'}</td>
                                <td>${entry.rate || '-'}</td>
                                <td>${cash.toLocaleString()}</td>
                                <td>${bank.toLocaleString()}</td>
                                <td>${nonCash.toLocaleString()}</td>
                                <td>${discount.toLocaleString()}</td> <!-- Discount Column -->
                                <td>${billAmount.toLocaleString()}</td>
                                <td>${runningTotalTaka.toLocaleString()}</td>
                            </tr>`;
                            tableBody.innerHTML += row;
                        });

                        // Update total row with the sum of quantities
                        document.getElementById("total-cash").textContent = totalCash.toLocaleString();
                        document.getElementById("total-bank").textContent = totalBank.toLocaleString();
                        document.getElementById("total-non-cash").textContent = totalNonCash.toLocaleString();
                        document.getElementById("total-discount").textContent = totalDiscount.toLocaleString(); // Updated Total Discount
                        document.getElementById("total-bill").textContent = totalBill.toLocaleString();
                        document.getElementById("total-taka").textContent = runningTotalTaka.toLocaleString();
                        document.getElementById("total-quantity").textContent = totalQuantity.toLocaleString();
                    });
            });
    });


// Fetch user role and hide actions if not admin
fetch('/check-role')
    .then(res => res.json())
    .then(data => {
        if (!data.loggedIn) {
            window.location.href = '/login.html';
            return;
        }

        window.isAdmin = data.role === 'Admin';

        if (!window.isAdmin) {
            // 🔒 Hide Action column header
            const actionHeader = document.getElementById('action-column');
            if (actionHeader) actionHeader.style.display = 'none';

            const formElements = document.querySelectorAll('form input, form button');
            formElements.forEach(el => el.disabled = true);

            const actionsTh = document.querySelector('th:last-child');
            if (actionsTh && actionsTh.textContent.includes('Actions')) {
                actionsTh.style.display = 'none';
            }

            // 🔒 Hide Admin-only navbar links
            const protectedLinks = document.querySelectorAll('.admin-only');
            protectedLinks.forEach(link => link.style.display = 'none');
        }

        return fetch('/buyers/list');
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to fetch buyer data.');
        return response.json();
    })
    .then(data => {
        renderTable(data);
    })
    .catch(error => {
        console.error('❌ Error fetching buyers:', error);
        document.getElementById('error-message').style.display = 'block';
    });

    });
	
// Render Table function to populate data
function renderTable(data) {
    const buyerDropdown = document.getElementById("buyer-dropdown");
    const selectedBuyerId = buyerDropdown.value; // Get the selected buyer's ID

    if (!selectedBuyerId || selectedBuyerId === "") {
        // If no buyer is selected, do not render the table
        return;
    }

    const tableBody = document.getElementById("timeline-table").querySelector("tbody");
    tableBody.innerHTML = ''; // Clear existing rows

    // Loop through data and add rows to the table
    let runningTotal = 0;  // Start the running total calculation
    data.forEach(entry => {
        const discount = parseFloat(entry.discount_amount) || 0;  // Fetch discount amount
        const cash = parseFloat(entry.cash) || 0;
        const bank = parseFloat(entry.bank) || 0;
        const nonCash = parseFloat(entry.non_cash) || 0;
        const billAmount = parseFloat(entry.bill_amount) || 0;

        // Update the running total with the discount
        runningTotal += billAmount - (cash + bank + nonCash + discount);  // Subtract payment and discount

        const row = `
            <tr>
                <td>${entry.date || '-'}</td>
                <td>${entry.type || '-'}</td>
                <td>${entry.bill_no || '-'}</td>
                <td>${entry.details || '-'}</td>
                <td>${entry.quantity || '-'}</td>
                <td>${entry.rate || '-'}</td>
                <td>${cash.toLocaleString()}</td>
                <td>${bank.toLocaleString()}</td>
                <td>${nonCash.toLocaleString()}</td>
                <td>${discount.toLocaleString()}</td> <!-- Discount Column -->
                <td>${billAmount.toLocaleString()}</td>
                <td>${runningTotal.toLocaleString()}</td> <!-- Total with Discount -->
            </tr>
        `;
        tableBody.innerHTML += row;
    });

    // Update total row with the sum of quantities
    document.getElementById("total-cash").textContent = data.reduce((acc, entry) => acc + (parseFloat(entry.cash) || 0), 0).toLocaleString();
    document.getElementById("total-bank").textContent = data.reduce((acc, entry) => acc + (parseFloat(entry.bank) || 0), 0).toLocaleString();
    document.getElementById("total-non-cash").textContent = data.reduce((acc, entry) => acc + (parseFloat(entry.non_cash) || 0), 0).toLocaleString();
    document.getElementById("total-discount").textContent = data.reduce((acc, entry) => acc + (parseFloat(entry.discount_amount) || 0), 0).toLocaleString(); // Discount Total
    document.getElementById("total-bill").textContent = data.reduce((acc, entry) => acc + (parseFloat(entry.bill_amount) || 0), 0).toLocaleString();
    document.getElementById("total-taka").textContent = runningTotal.toLocaleString();
    document.getElementById("total-quantity").textContent = data.reduce((acc, entry) => acc + (parseFloat(entry.quantity) || 0), 0).toLocaleString();
}


// Export to Excel functionality
document.getElementById('export-excel').addEventListener('click', function () {
    const table = document.getElementById('timeline-table'); // Get the table
    if (!table) {
        alert('Error: Table not found');
        return;
    }

    const buyerName = buyerDropdown.selectedOptions[0].text;
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

    // Generate the dynamic filename
    const sanitizedBuyerName = buyerName.replace(/\s+/g, "_");
    const fileName = `Buyer_Timeline_${sanitizedBuyerName}_${formattedDate}_${formattedTime}.xlsx`;

    // Convert the table to a workbook
    const wb = XLSX.utils.table_to_book(table, { sheet: 'Sheet1' });
    XLSX.writeFile(wb, fileName); // Save the workbook as an Excel file
});

// Add event listener for the PDF export button
document.getElementById('export-pdf').addEventListener('click', function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const table = document.getElementById('timeline-table');
    const buyerDropdown = document.getElementById('buyer-dropdown');
    const selectedBuyerId = buyerDropdown.value; 
    const buyerName = buyerDropdown.selectedOptions[0].text;

    // Generate the dynamic filename
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
    const fileName = `Buyer_Timeline_${sanitizedBuyerName}_${formattedDate}_${formattedTime}.pdf`;

    // Fetch buyer location and generate PDF
    fetch(`/buyers/location/${selectedBuyerId}`)
        .then(response => response.json())
        .then(data => {
            const buyerLocation = data.location;
            generatePDF(doc, buyerName, buyerLocation, formattedDate, fileName);
        })
        .catch(error => {
            console.error("Error fetching buyer location:", error);
            generatePDF(doc, buyerName, "", formattedDate, fileName);
        });
});

// Function to generate and save PDF with watermark
function generatePDF(doc, buyerName, buyerLocation, formattedDate, fileName) {
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const headerBarHeight = 18;
    const startY = headerBarHeight + 30;

    const watermarkImg = new Image();
    watermarkImg.src = "/public/watermark.png";

    watermarkImg.onload = function () {

        // header + watermark (for every page)
        function addHeaderAndWatermark(pageNumber) {
            // watermark
            doc.setGState(new doc.GState({ opacity: 0.2 }));
            const wx = pageWidth / 4;
            const wy = pageHeight / 3;
            const ww = pageWidth / 2;
            const wh = pageHeight / 4;
            doc.addImage(watermarkImg, 'PNG', wx, wy, ww, wh);
            doc.setGState(new doc.GState({ opacity: 1 }));

            // header bar
            doc.setFillColor(49, 178, 230);
            doc.rect(0, 0, pageWidth, headerBarHeight, 'F');

            // logo
            try {
                doc.addImage('/public/lsg.png', 'PNG', 14, 5, 30, 10);
            } catch (e) {
                // ignore if logo missing
            }

            // title
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 255, 255);
            doc.text("Buyer Timeline", pageWidth - 50, 11);

            // invoice-to + date only on page 1
            if (pageNumber === 1) {
                const invoiceY = 30;
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                doc.text("INVOICE TO:", 14, invoiceY);

                doc.setFont("helvetica", "normal");
                doc.text(buyerName, 14, invoiceY + 5);

                if (buyerLocation) {
                    doc.text(buyerLocation, 14, invoiceY + 10);
                }

                const dateLabel = "DATE:";
                const dateLabelWidth = doc.getTextWidth(dateLabel);
                const xRight = pageWidth - dateLabelWidth - 40;

                doc.setFont("helvetica", "bold");
                doc.text(dateLabel, xRight, invoiceY);
                doc.setFont("helvetica", "normal");
                doc.text(formattedDate, xRight, invoiceY + 5);
            }
        }

        // build table
        const tableEl = document.getElementById('timeline-table');

        doc.autoTable({
            html: tableEl,
            theme: 'grid',
            startY: startY,
            margin: { horizontal: 10, top: 20, bottom: 40 },
            headStyles: {
                fillColor: [0, 0, 0],
                textColor: [255, 255, 255],
                fontSize: 7,
                fontStyle: 'bold',
            },
            bodyStyles: {
                fontSize: 8,
                textColor: [0, 0, 0],
            },
            footStyles: {
                fillColor: [220, 220, 220],
                textColor: [0, 0, 0],
                fontSize: 8,
                fontStyle: 'bold',
            },
            pageBreak: 'auto',
            showHead: 'everyPage',
            // we keep showFoot: 'lastPage' if the table has a tfoot in HTML
            showFoot: 'lastPage',
            didDrawPage: function (data) {
                // header + watermark on each page
                addHeaderAndWatermark(data.pageNumber);
            },
        });

        // ⬇️ footer ONLY on last page
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

        // finally save
        doc.save(fileName);
    };

    watermarkImg.onerror = function () {
        console.error("Error loading watermark image.");
    };
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