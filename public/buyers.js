let buyerData = []; // Store fetched buyer data for filtering

// Format number with commas for display
function formatNumberWithCommas(number) {
    return parseFloat(number).toLocaleString('en-US');
}

// Function to calculate Total Amount with formatting
function calculateTotalAmount() {
    const paidAmountInput = document.getElementById('paid-amount');
    const unpaidAmountInput = document.getElementById('unpaid-amount');
    const totalAmountInput = document.getElementById('total-amount');

    // Remove commas and parse the input values as numbers
    const paidAmount = parseFloat(paidAmountInput.value.replace(/,/g, '')) || 0;
    const unpaidAmount = parseFloat(unpaidAmountInput.value.replace(/,/g, '')) || 0;

    // Calculate total amount
    const totalAmount = paidAmount + unpaidAmount;

    // Format the inputs and the total amount with commas for display
    paidAmountInput.value = paidAmount.toLocaleString('en-US');
    unpaidAmountInput.value = unpaidAmount.toLocaleString('en-US');
    totalAmountInput.value = totalAmount.toLocaleString('en-US');
}



// Fetch buyers and populate the table
fetch('/buyers/list')
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch buyer data.');
        }
        return response.json();
    })
    .then(data => {
        buyerData = data; // Store data globally
        renderTable(buyerData);
    })
    .catch(error => {
        console.error('Error fetching buyers:', error);
        const errorMessage = document.getElementById('error-message');
        errorMessage.style.display = 'block';
        errorMessage.textContent = 'Error fetching buyer data. Please try again.';
    });

// Delete a buyer
function deleteBuyer(buyerId) {
    if (confirm('Are you sure you want to delete this buyer?')) {
        fetch(`/buyers/delete/${buyerId}`, { method: 'DELETE' })
            .then(response => {
                // Check if the response status indicates success
                if (response.ok) {
                    return response.text(); // Parse the success message
                } else {
                    // Handle non-2xx HTTP status codes
                    throw new Error(`Failed to delete buyer. Status: ${response.status}`);
                }
            })
            .then(message => {
                alert(message); // Show success message
                location.reload(); // Reload the page to refresh the table
            })
            .catch(error => {
                // Log the actual error message for debugging
                console.error('Error deleting buyer:', error);
                alert('Failed to delete buyer. Please try again.');
            });
    }
}

// Add a delete button to each buyer row
function renderTable(data) {
    const tableBody = document.getElementById('buyer-list');
    tableBody.innerHTML = ''; // Clear existing rows

    data.forEach(buyer => {
        const row = `
            <tr>
                <td>${buyer.id}</td>
                <td>${buyer.name}</td>
                <td>${buyer.location}</td>
                <td>${buyer.contact_number}</td>
                <td>
                    <button class="delete-btn" onclick="deleteBuyer(${buyer.id})">Delete</button>
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
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
