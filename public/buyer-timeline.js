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

    // Fetch timeline when buyer is selected
    buyerDropdown.addEventListener("change", function () {
        const buyerId = buyerDropdown.value;
        if (!buyerId) return;

        fetch(`/buyer-timeline?buyer_id=${buyerId}`)
            .then(response => response.json())
            .then(data => {
                tableBody.innerHTML = ""; // Clear previous data

                let totalCash = 0;
                let totalBank = 0;
                let totalNonCash = 0;
                let totalBill = 0;
                let lastTotalTaka = 0; // Store the last value instead of summing

                data.timeline.forEach((entry, index) => {
                    // Parse numbers safely
                    const cash = parseFloat(entry.cash) || 0;
                    const bank = parseFloat(entry.bank) || 0;
                    const nonCash = parseFloat(entry.non_cash) || 0;
                    const billAmount = parseFloat(entry.bill_amount) || 0;
                    const totalTakaValue = parseFloat(entry.total_taka) || 0;

                    // Sum up totals (except Total Taka)
                    totalCash += cash;
                    totalBank += bank;
                    totalNonCash += nonCash;
                    totalBill += billAmount;

                    // Set lastTotalTaka as the last row's value
                    lastTotalTaka = totalTakaValue;

                    // Add row to the table
                    const row = `<tr>
                        <td>${entry.date}</td>
                        <td>${entry.type || '-'}</td>
                        <td>${entry.details || '-'}</td>
                        <td>${entry.quantity || '-'}</td>
                        <td>${entry.rate || '-'}</td>
                        <td>${cash.toLocaleString()}</td>
                        <td>${bank.toLocaleString()}</td>
                        <td>${nonCash.toLocaleString()}</td>
                        <td>${billAmount.toLocaleString()}</td>
                        <td>${totalTakaValue.toLocaleString()}</td>
                    </tr>`;
                    tableBody.innerHTML += row;
                });

                // Update total row
                document.getElementById("total-cash").textContent = totalCash.toLocaleString();
                document.getElementById("total-bank").textContent = totalBank.toLocaleString();
                document.getElementById("total-non-cash").textContent = totalNonCash.toLocaleString();
                document.getElementById("total-bill").textContent = totalBill.toLocaleString();
                document.getElementById("total-taka").textContent = lastTotalTaka.toLocaleString();
            });
    });
});

// Export to Excel
document.getElementById('export-excel').addEventListener('click', function () {
    const table = document.getElementById('timeline-table'); // Get the table
    const wb = XLSX.utils.table_to_book(table, { sheet: 'Sheet1' }); // Convert the table to a workbook
    XLSX.writeFile(wb, 'buyer_timeline.xlsx'); // Save the workbook as an Excel file
});

document.getElementById('export-pdf').addEventListener('click', function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const table = document.getElementById('timeline-table');
    const buyerDropdown = document.getElementById('buyer-dropdown');
    const selectedBuyerId = buyerDropdown.value; // Get selected buyer's ID
    const buyerName = buyerDropdown.selectedOptions[0].text; // Get selected buyer's name

    // Fetch buyer location from the database based on selected buyer ID
    fetch(`/buyers/location/${selectedBuyerId}`)
        .then(response => response.json())
        .then(data => {
            const buyerLocation = data.location; // Fetch the location of the buyer
            const currentDate = new Date(); // Get the current date

            // Format the date as "21 January 2025"
            const formattedDate = currentDate.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });

            // --- Header Bar ---
            const headerBarHeight = 20; // Height of the header bar
            doc.setFillColor(49, 178, 230); // Set background color for the bar (Blue)
            doc.rect(0, 0, doc.internal.pageSize.width, headerBarHeight, 'F'); // Draw the header bar

            // Add logo to the left side of the header
            doc.addImage('/public/lsg.png', 'PNG', 14, 5, 30, 10);  // Adjust the path accordingly

            // Add "RECEIPT" text to the right side of the header
            doc.setFontSize(14); // Set font size for "RECEIPT"
            doc.setFont("helvetica", "bold"); // Set font to Helvetica and bold
            doc.setTextColor(255, 255, 255); // Set text color to white
            doc.text("RECEIPT", doc.internal.pageSize.width - 50, 12); // Position text on the right

            // --- Header Details ---
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0); // Black color for the header details
            doc.text("INVOICE TO:", 14, headerBarHeight + 10); // Position below the header
			doc.setFont("helvetica", "normal"); // Set font style to normal
			doc.text(`${buyerName}`, 14, headerBarHeight + 15);
			doc.text(`${buyerLocation}`, 14, headerBarHeight + 20);

            // --- DATE Right-Aligned ---
            const dateLabel = "DATE:";
            const dateText = `${formattedDate}`;
            const dateLabelWidth = doc.getTextWidth(dateLabel); // Get width of "DATE:"
            const dateTextWidth = doc.getTextWidth(dateText); // Get width of currentDate

            // Position for right-aligning the "DATE:" and currentDate
            const xPosition = doc.internal.pageSize.width - dateLabelWidth - 40; // Right align with padding

            // Draw the right-aligned "DATE:" and currentDate
doc.setFont("helvetica", "bold"); // Set font style to bold for the label
doc.text(dateLabel, xPosition, headerBarHeight + 10);

doc.setFont("helvetica", "normal"); // Set font style to normal for the date text
doc.text(dateText, xPosition, headerBarHeight + 15);

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
            doc.save('buyer_timeline.pdf');
        })
        .catch(error => {
            console.error("Error fetching buyer location:", error);
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