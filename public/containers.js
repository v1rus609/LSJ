document.addEventListener('DOMContentLoaded', function () {
    const searchBox = document.getElementById('search-box');  // Search input field
    const containerList = document.getElementById('container-list');  // Table body
    let containerData = [];  // Store the fetched container data for filtering

    // Fetch container data and render the table
    fetch('/containers/list')  // Adjust endpoint if necessary
        .then(response => response.json())
        .then(data => {
            containerData = data.map(container => ({
                id: container.id,
                container_number: container.container_number,
                weight: container.weight,
                arrival_date: container.arrival_date,
                remaining_weight: container.remaining_weight
            }));

            // Render the table after fetching the container data
            renderTable(containerData);
        })
        .catch(error => {
            console.error('Error fetching containers:', error);
            document.getElementById('error-message').style.display = 'block';  // Show error message if data fetch fails
        });

    // Render the container list in the table
    function renderTable(data) {
        containerList.innerHTML = '';  // Clear existing rows

        data.forEach(container => {
            const arrivalDate = new Date(container.arrival_date);
            const formattedDate = new Intl.DateTimeFormat('en-GB').format(arrivalDate);  // Format the arrival date as dd/mm/yyyy

            const row = `
                <tr>
                    <td>${container.id}</td>
                    <td>${formattedDate}</td>
                    <td>${container.container_number}</td>
                    <td>${formatNumberWithCommas(container.weight)}</td>
                    <td>${formatNumberWithCommas(container.remaining_weight)}</td>
                    <td><button class="delete-btn" data-id="${container.id}">Delete</button></td>
                </tr>
            `;
            containerList.innerHTML += row;
        });

        // Attach event listeners for the delete buttons
        const deleteButtons = document.querySelectorAll('.delete-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', handleDeleteContainer);
        });
    }

    // Helper function to format numbers with commas
    function formatNumberWithCommas(number) {
        return parseFloat(number).toLocaleString('en-US');
    }

    // Filter containers based on search input
    searchBox.addEventListener('input', function () {
        const searchValue = this.value.toLowerCase();
        const filteredData = containerData.filter(container =>
            container.container_number.toLowerCase().includes(searchValue)  // Match the search value with container number
        );
        renderTable(filteredData);  // Re-render the table with the filtered data
    });

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
