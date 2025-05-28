document.addEventListener('DOMContentLoaded', function () {
    const searchBox = document.getElementById('search-box');
    const containerList = document.getElementById('container-list');
    let containerData = [];

    // Fetch container data and render the table
    fetch('/containers/list')
        .then(response => response.json())
        .then(data => {
            containerData = data.map(container => ({
                id: container.id,
                container_number: container.container_number,
                weight: container.weight,
                arrival_date: container.arrival_date,
                total_weight_sold: container.total_weight_sold,
                total_weight_returned: container.total_weight_returned,
                remaining_weight: container.remaining_weight
            }));

            // Render the table after fetching the container data
            renderTable(containerData);
        })
        .catch(error => {
            console.error('Error fetching containers:', error);
            document.getElementById('error-message').style.display = 'block'; // Show error message if data fetch fails
        });

function renderTable(data) {
    containerList.innerHTML = ''; // Clear existing rows
    let totalSold = 0, totalReturned = 0, totalRemaining = 0, totalWeight = 0; // Initialize totals

    data.forEach((container, index) => {
        const arrivalDate = new Date(container.arrival_date);
        const formattedDate = new Intl.DateTimeFormat('en-GB').format(arrivalDate); // Format date as dd/mm/yyyy

        // Accumulate totals
        totalSold += parseFloat(container.total_weight_sold) || 0;
        totalReturned += parseFloat(container.total_weight_returned) || 0;
        totalRemaining += parseFloat(container.remaining_weight) || 0;
        totalWeight += parseFloat(container.weight) || 0; // Accumulate total weight

        const row = `
            <tr data-id="${container.id}">
                <td>${index + 1}</td>
                <td>${formattedDate}</td>
                <td>${container.container_number}</td>
                <td>
                    <span class="weight-display" data-id="${container.id}">${container.weight}</span>
                    <input class="weight-input" type="number" value="${container.weight}" data-id="${container.id}" style="display: none;" />
                </td>
                <td>${formatNumberWithCommas(container.total_weight_sold)}</td>
                <td>${formatNumberWithCommas(container.total_weight_returned)}</td>
                <td>${formatNumberWithCommas(container.remaining_weight)}</td>
                <td>
                    <button class="edit-btn" data-id="${container.id}">Edit</button>
                    <button class="delete-btn" data-id="${container.id}"><span class="delete-text">Delete</span><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>
        `;
        containerList.innerHTML += row;
    });


        // Totals Row (including total of Weight column)
        const totalRow = `
            <tr class="total-row">
                <td colspan="3"><strong>Totals:</strong></td>
                <td><strong>${formatNumberWithCommas(totalWeight)}</strong></td>
                <td><strong>${formatNumberWithCommas(totalSold)}</strong></td>
                <td><strong>${formatNumberWithCommas(totalReturned)}</strong></td>
                <td><strong>${formatNumberWithCommas(totalRemaining)}</strong></td>
                <td></td> <!-- Empty cell for Action column -->
            </tr>
        `;
        containerList.innerHTML += totalRow;

        // Add event listeners for "Edit" and "Delete" buttons
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', handleEditContainer);
        });

        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', handleDeleteContainer);
        });

        // 🧼 CLEANUP: If not admin, hide delete buttons and action column
        if (!window.isAdmin) {
            // Hide all delete buttons
            document.querySelectorAll('.delete-btn').forEach(btn => btn.style.display = 'none');

            // Hide the 8th <td> (action column) in all rows
            containerList.querySelectorAll('tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length > 7) {
                    cells[7].style.display = 'none';
                }
            });

            // Hide totals row last column
            const totalRow = document.querySelector('.total-row');
            if (totalRow) {
                const cells = totalRow.querySelectorAll('td');
                if (cells.length > 7) {
                    cells[7].style.display = 'none';
                }
            }
        }
    }

    // Helper function to format numbers with commas
    function formatNumberWithCommas(number) {
        return parseFloat(number).toLocaleString('en-US');
    }

    // Filter containers based on search input
    searchBox.addEventListener('input', function () {
        const searchValue = this.value.toLowerCase();
        const filteredData = containerData.filter(container =>
            container.container_number.toLowerCase().includes(searchValue) // Match the search value with container number
        );
        renderTable(filteredData); // Re-render the table with the filtered data
    });

    // Handle Edit Button Click
    function handleEditContainer(event) {
        const containerId = parseInt(event.target.dataset.id); // Convert the ID to a number
        console.log('Container ID:', containerId); // Log the container ID to ensure it's a number

        // Find the container by ID from containerData
        const container = containerData.find(c => c.id === containerId);  // Ensure both sides are numbers

        if (!container) {
            console.error('Container not found!');
            alert('Container not found!');
            return;
        }

        const weightInput = document.querySelector(`.weight-input[data-id="${containerId}"]`);
        const weightDisplay = document.querySelector(`.weight-display[data-id="${containerId}"]`);

        // Show the weight input field and hide the display
        weightInput.style.display = 'inline';
        weightDisplay.style.display = 'none';
        weightInput.focus();

        // When the user leaves the input field (on blur)
        weightInput.addEventListener('blur', function () {
            const newWeight = parseFloat(weightInput.value);
            const oldWeight = container.weight;

            if (newWeight !== oldWeight) {
                // Show a confirmation dialog
                const confirmChange = confirm('Are you sure you want to change the weight?');
                if (confirmChange) {
                    // Handle the weight update
                    const weightDifference = newWeight - oldWeight;

                    // Update the remaining weight based on the change in weight
                    let updatedRemainingWeight;
                    if (weightDifference > 0) {
                        // If new weight is greater, add the difference to remaining weight
                        updatedRemainingWeight = container.remaining_weight + weightDifference;
                    } else {
                        // If new weight is less, subtract the difference from remaining weight
                        updatedRemainingWeight = container.remaining_weight - Math.abs(weightDifference);
                    }

                    console.log('Updated Remaining Weight:', updatedRemainingWeight);

                    // Update the container data in the backend
                    fetch(`/container/update/${containerId}`, {
                        method: 'POST',
                        body: JSON.stringify({ weight: newWeight, remaining_weight: updatedRemainingWeight }),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            alert('Container weight updated successfully');
                            // Update container data in memory
                            container.weight = newWeight;
                            container.remaining_weight = updatedRemainingWeight;
                            renderTable(containerData); // Re-render table
                        } else {
                            alert('Failed to update container weight');
                        }
                    })
                    .catch(error => {
                        console.error('Error updating container:', error);
                    });
                } else {
                    // If user cancels, revert the input field to the old weight
                    weightInput.value = oldWeight;
                    weightInput.style.display = 'none';
                    weightDisplay.style.display = 'inline';
                }
            } else {
                // If no change, just hide the input field and show the display again
                weightInput.style.display = 'none';
                weightDisplay.style.display = 'inline';
            }
        });
    }

    // Handle Delete Button Click
    function handleDeleteContainer(event) {
        const containerId = event.target.dataset.id;

        if (confirm("Are you sure you want to delete this container?")) {
            // Send a request to the backend to delete the container
            fetch(`/container/delete/${containerId}`, {
                method: 'DELETE',
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert("Container deleted successfully");
                    // Re-fetch the container list after deletion
                    fetch('/containers/list')
                        .then(response => response.json())
                        .then(data => {
                            containerData = data.map(container => ({
                                id: container.id,
                                container_number: container.container_number,
                                weight: container.weight,
                                arrival_date: container.arrival_date,
                                total_weight_sold: container.total_weight_sold,
                                total_weight_returned: container.total_weight_returned,
                                remaining_weight: container.remaining_weight
                            }));
                            renderTable(containerData);
                        });
                } else {
                    alert("Failed to delete container.");
                }
            })
            .catch(error => {
                console.error('Error deleting container:', error);
                alert('Failed to delete container.');
            });
        }
    }
});


// Export table to Excel
function exportToExcel() {
    const table = document.getElementById('container-list');  // Table element
    const workbook = XLSX.utils.table_to_book(table, { sheet: "Container List" });  // Convert table to workbook
    XLSX.writeFile(workbook, 'Container_List.xlsx');  // Download the Excel file
}

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
    const fileName = `Container_List_${formattedDate}_${formattedTime}.pdf`;

    // Proceed to generate the PDF without including the buyer's name or location
    generatePDF(doc, formattedDate, fileName);
}

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
            doc.setGState(new doc.GState({ opacity: 0.2 }));
            const watermarkX = pageWidth / 4;
            const watermarkY = pageHeight / 3;
            const watermarkWidth = pageWidth / 2;
            const watermarkHeight = pageHeight / 4;

            doc.addImage(watermarkImg, 'PNG', watermarkX, watermarkY, watermarkWidth, watermarkHeight);
            doc.setGState(new doc.GState({ opacity: 1 }));

            doc.setFillColor(49, 178, 230);
            doc.rect(0, 0, pageWidth, headerBarHeight, 'F');
            doc.addImage('/public/lsg.png', 'PNG', 14, 5, 30, 10);
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 255, 255);
            doc.text("Container List", pageWidth - 50, 11);

            if (firstPage) {
                const dateLabel = "Date:";
                const dateText = `${formattedDate}`;
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

        // Read data from the visible HTML table
        const table = document.getElementById('container-list');
        const rows = table.querySelectorAll('tr:not(.total-row)'); // exclude totals row

        const tableRows = [];
        let totalWeight = 0, totalSold = 0, totalReturned = 0, totalRemaining = 0;

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 7) {
                const rowData = [
                    cells[0].innerText.trim(), // ID
                    cells[1].innerText.trim(), // Arrival Date
                    cells[2].innerText.trim(), // Container #
                    cells[3].innerText.trim(), // Weight
                    cells[4].innerText.trim(), // Sold
                    cells[5].innerText.trim(), // Returned
                    cells[6].innerText.trim()  // Remaining
                ];
                tableRows.push(rowData);

                // Add to totals
                totalWeight += parseFloat(cells[3].innerText.replace(/,/g, '')) || 0;
                totalSold += parseFloat(cells[4].innerText.replace(/,/g, '')) || 0;
                totalReturned += parseFloat(cells[5].innerText.replace(/,/g, '')) || 0;
                totalRemaining += parseFloat(cells[6].innerText.replace(/,/g, '')) || 0;
            }
        });

        const foot = [[
            { content: "Totals:", colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
            totalWeight.toLocaleString('en-US'),
            totalSold.toLocaleString('en-US'),
            totalReturned.toLocaleString('en-US'),
            totalRemaining.toLocaleString('en-US')
        ]];

        const options = {
            head: [['ID', 'Arrival Date', 'Container Number', 'Weight', 'Sold', 'Returned', 'Remaining Weight']],
            body: tableRows,
            foot: foot,
            showFoot: 'lastPage',
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
            footStyles: {
                fillColor: [220, 220, 220],
                textColor: [0, 0, 0],
                fontSize: 10,
                fontStyle: 'bold',
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
