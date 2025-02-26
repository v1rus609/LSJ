let containerData = []; // Store fetched container data for filtering

// Fetch container data and render the table
fetch('/containers/list') // ✅ Fetch directly from the updated containers table
    .then(response => response.json())
    .then(data => {
        containerData = data.map(container => ({
            id: container.id,
            container_number: container.container_number,
            weight: container.weight, // Total weight of the container from the DB
            arrival_date: container.arrival_date
        }));

        // Now fetch the sold and returned data dynamically
        fetchSoldAndReturnedData().then(() => {
            renderTable(containerData); // Render table after calculating remaining weight
        });
    })
    .catch(error => console.error('Error fetching containers:', error));

// Fetch sold and returned data
async function fetchSoldAndReturnedData() {
    // Fetch sales data (weight sold for each container)
    const salesResponse = await fetch('/sales/total-sold');
    const salesData = await salesResponse.json();

    // Fetch returned data (weight returned for each container)
    const returnsResponse = await fetch('/purchase-returns/total-returned');
    const returnsData = await returnsResponse.json();

    // Calculate remaining weight for each container
    containerData.forEach(container => {
        const soldWeight = salesData[container.id] || 0; // Total weight sold for the container
        const returnedWeight = returnsData[container.id] || 0; // Total weight returned for the container

        container.remaining_weight = container.weight - soldWeight + returnedWeight;
        container.total_sold = soldWeight; // Store total sold weight for reference
        container.total_returned = returnedWeight; // Store total returned weight for reference
    });
}

// Render table rows with formatted values
function renderTable(data) {
    const tableBody = document.getElementById('container-list');
    tableBody.innerHTML = ''; // Clear existing rows

    data.forEach(container => {
        const arrivalDate = new Date(container.arrival_date);
        const formattedDate = new Intl.DateTimeFormat('en-GB').format(arrivalDate); // dd/mm/yyyy format

        const formatNumberWithCommas = (number) => {
            return parseFloat(number).toLocaleString('en-US'); // Format number with commas
        };

        const row = `
            <tr>
                <td>${container.id}</td>
				<td>${formattedDate}</td>
                <td>${container.container_number}</td>
                <td>${formatNumberWithCommas(container.weight)}</td>
                <td>${formatNumberWithCommas(container.remaining_weight)}</td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}

// Filter containers based on search input
document.getElementById('search-box').addEventListener('input', function () {
    const searchValue = this.value.toLowerCase();
    const filteredData = containerData.filter(container =>
        container.container_number.toLowerCase().includes(searchValue)
    );
    renderTable(filteredData);
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
