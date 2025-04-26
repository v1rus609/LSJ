document.addEventListener("DOMContentLoaded", function () {
    const buyerDropdown = document.getElementById("buyer-dropdown");
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
        });

    // Fetch opening balance for the selected buyer
// Fetch opening balance for the selected buyer
buyerDropdown.addEventListener("change", function () {
    const buyerId = buyerDropdown.value;
    if (!buyerId) return;

    // Fetch opening balance for the selected buyer
    fetch(`/buyers/opening-balance/${buyerId}`)
        .then(response => response.json())
        .then(data => {
            let openingBalance = data.opening_balance || 0; // Default to 0 if no opening balance

            // Fetch buyer timeline data
            fetch(`/buyer-timeline?buyer_id=${buyerId}`)
                .then(response => response.json())
                .then(data => {
                    tableBody.innerHTML = ""; // Clear previous data

                    let totalCash = 0;
                    let totalBank = 0;
                    let totalNonCash = 0;
                    let totalBill = openingBalance; // Start with opening balance as initial totalBill
                    let runningTotalTaka = openingBalance; // Initialize running total with opening balance
                    let totalQuantity = 0; // Initialize total quantity

                    // Add Opening Balance as the first row if greater than 0 or negative
                    const openingBalanceRow = `<tr>
                        <td>-</td>
                        <td>Opening Balance</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>${openingBalance.toLocaleString()}</td> <!-- Only Bill Amount -->
                        <td>${runningTotalTaka.toLocaleString()}</td> <!-- Use runningTotalTaka -->
                        <td>-</td>
                    </tr>`;
                    tableBody.innerHTML += openingBalanceRow;

                    // Loop through timeline data and add rows
                    data.timeline.forEach((entry) => {
                        // Parse numbers safely
                        const cash = parseFloat(entry.cash) || 0;
                        const bank = parseFloat(entry.bank) || 0;
                        const nonCash = parseFloat(entry.non_cash) || 0;
                        const billAmount = parseFloat(entry.bill_amount) || 0;
                        const totalTakaValue = parseFloat(entry.total_taka) || 0;
                        const quantity = parseFloat(entry.quantity) || 0; // Get quantity

                        // Capitalize the first letter of the "Details" field
                        let details = entry.details || '-';
                        details = details.charAt(0).toUpperCase() + details.slice(1); // Capitalize first letter

                        // Sum up totals (except Total Taka)
                        totalCash += cash;
                        totalBank += bank;
                        totalNonCash += nonCash;
                        totalQuantity += quantity; // Add quantity to total

                        // Only add the purchase amount to the totalBill, excluding returns and payments
                        if (entry.type === 'Purchase') {
                            totalBill += billAmount;
                        }

                        // Update running total of Taka for this entry
                        runningTotalTaka += billAmount; // Add purchase bill amount to runningTotalTaka
                        runningTotalTaka -= (cash + bank + nonCash); // Deduct payments and returns from running total

                        // Add row to the table
                        const row = `<tr>
                            <td>${entry.date}</td>
                            <td>${entry.type || '-'}</td>
                            <td>${entry.bill_no || '-'}</td> <!-- Bill No. comes after Details -->
                            <td>${details}</td> <!-- Use the capitalized details here -->
                            <td>${quantity || '-'}</td> <!-- Display quantity -->
                            <td>${entry.rate || '-'}</td>
                            <td>${cash.toLocaleString()}</td>
                            <td>${bank.toLocaleString()}</td>
                            <td>${nonCash.toLocaleString()}</td>
                            <td>${billAmount.toLocaleString()}</td>
                            <td>${runningTotalTaka.toLocaleString()}</td> <!-- Updated Total Taka -->
                        </tr>`;
                        tableBody.innerHTML += row;
                    });

                    // Update total row with the sum of quantities
                    document.getElementById("total-cash").textContent = totalCash.toLocaleString();
                    document.getElementById("total-bank").textContent = totalBank.toLocaleString();
                    document.getElementById("total-non-cash").textContent = totalNonCash.toLocaleString();
                    document.getElementById("total-bill").textContent = totalBill.toLocaleString();
                    document.getElementById("total-taka").textContent = runningTotalTaka.toLocaleString(); // Updated Total Taka
                    document.getElementById("total-quantity").textContent = totalQuantity.toLocaleString(); // Updated Total Quantity
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
    data.forEach(entry => {
        const row = `
            <tr>
                <td>${entry.date || '-'}</td>
                <td>${entry.type || '-'}</td>
                <td>${entry.bill_no || '-'}</td>
                <td>${entry.details || '-'}</td>
                <td>${entry.quantity || '-'}</td>
                <td>${entry.rate || '-'}</td>
                <td>${entry.cash || '-'}</td>
                <td>${entry.bank || '-'}</td>
                <td>${entry.non_cash || '-'}</td>
                <td>${entry.bill_amount || '-'}</td>
                <td>${entry.total_taka || '-'}</td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
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
        // --- PDF Content Generation ---
        const headerBarHeight = 20;
        doc.setFillColor(49, 178, 230);
        doc.rect(0, 0, doc.internal.pageSize.width, headerBarHeight, 'F');
        doc.addImage('/public/lsg.png', 'PNG', 14, 5, 30, 10);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("RECEIPT", doc.internal.pageSize.width - 50, 12);

        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text("INVOICE TO:", 14, headerBarHeight + 10);
        doc.setFont("helvetica", "normal");
        doc.text(`${buyerName}`, 14, headerBarHeight + 15);
        if (buyerLocation) {
            doc.text(`${buyerLocation}`, 14, headerBarHeight + 20);
        }

        const dateLabel = "DATE:";
        const dateText = `${formattedDate}`;
        const dateLabelWidth = doc.getTextWidth(dateLabel);
        const xPosition = doc.internal.pageSize.width - dateLabelWidth - 40;

        doc.setFont("helvetica", "bold");
        doc.text(dateLabel, xPosition, headerBarHeight + 10);
        doc.setFont("helvetica", "normal");
        doc.text(dateText, xPosition, headerBarHeight + 15);

        doc.autoTable({
            html: document.getElementById('timeline-table'),
            startY: headerBarHeight + 30,
            theme: 'grid',
            headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
            bodyStyles: { fontSize: 9, textColor: [0, 0, 0] },
            footStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontSize: 10, fontStyle: 'bold' },
        });

        const pageHeight = doc.internal.pageSize.height;
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

        const watermarkImg = new Image();
        watermarkImg.src = "/public/watermark.png";
        watermarkImg.onload = function () {
            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;
            doc.setGState(new doc.GState({ opacity: 0.2 }));
            doc.addImage(watermarkImg, 'PNG', pageWidth / 4, pageHeight / 3, pageWidth / 2, pageHeight / 4);
            doc.setGState(new doc.GState({ opacity: 1 }));
            doc.save(fileName);
        };
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

 fetch('/check-role')
    .then(res => res.json())
    .then(data => {
        if (!data.loggedIn) {
            window.location.href = '/login.html';
            return;
        }

        isAdmin = data.role === 'Admin';

        if (!isAdmin) {
            document.getElementById('export-excel')?.remove();
            document.getElementById('export-pdf')?.remove();
        }
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