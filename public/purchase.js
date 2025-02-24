// Helper function to format numbers with commas
function formatNumberWithCommas(number) {
    return parseFloat(number).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Function to fetch and populate the buyer and container filters
function fetchFilters() {
    // Fetch buyers
    fetch('/buyers/list')
        .then(response => response.json())
        .then(data => {
            console.log("Fetched Buyers:", data);  // Log fetched buyers data
            const buyerFilter = document.getElementById('buyer-filter');
            data.forEach(buyer => {
                const option = document.createElement('option');
                option.value = buyer.id;
                option.text = buyer.name;
                buyerFilter.appendChild(option);
            });
        });

    // Fetch containers
    fetch('/containers/list')
        .then(response => response.json())
        .then(data => {
            console.log("Fetched Containers:", data);  // Log fetched containers data
            const containerFilter = document.getElementById('container-filter');
            data.forEach(container => {
                const option = document.createElement('option');
                option.value = container.id;
                option.text = container.container_number;
                containerFilter.appendChild(option);
            });
        });
}

// Fetch and display purchases based on selected filters
function fetchPurchases(filters = {}) {
    let query = '/purchases?';
    if (filters.buyer) query += `buyer=${filters.buyer}&`;
    if (filters.container) query += `container=${filters.container}&`;

    fetch(query)
        .then(response => response.json())
        .then(data => {
            console.log("Fetched Purchases:", data);  // Add logs here to inspect the data

            const tableBody = document.getElementById('purchase-table').querySelector('tbody');
            tableBody.innerHTML = '';

            let totalPaid = 0;
            let totalUnpaid = 0;
            let grandTotal = 0;

            data.forEach((purchase, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${formatDate(purchase.purchase_date) || "N/A"}</td>
                    <td>${purchase.buyer_name || "N/A"}</td>
                    <td>${purchase.container_number || "N/A"}</td>
                    <td>${formatNumberWithCommas(purchase.weight_sold || 0)}</td>
                    <td>${formatNumberWithCommas(purchase.price_per_kg || 0)}</td>
                    <td>${formatNumberWithCommas(purchase.paid_amount || 0)}</td>
                    <td>${formatNumberWithCommas(purchase.unpaid_amount || 0)}</td>
                    <td>${formatNumberWithCommas(purchase.total_price || 0)}</td>
                    <td>
                        <button class="edit-btn" data-id="${purchase.sale_id}">Edit</button>
                        <button class="delete-btn" data-id="${purchase.sale_id}">Delete</button>
                    </td>
                `;

                tableBody.appendChild(row);

                totalPaid += purchase.paid_amount;
                totalUnpaid += purchase.unpaid_amount;
                grandTotal += purchase.total_price;
            });

            document.getElementById('total-paid').textContent = formatNumberWithCommas(totalPaid);
            document.getElementById('total-unpaid').textContent = formatNumberWithCommas(totalUnpaid);
            document.getElementById('grand-total').textContent = formatNumberWithCommas(grandTotal);
        })
        .catch(error => console.error('Error fetching purchases:', error));
}

// Event delegation: Handle Edit and Delete buttons
document.addEventListener('DOMContentLoaded', function () {
    // Fetch filters and purchases on page load
    fetchFilters();
    fetchPurchases();

    const table = document.getElementById('purchase-table');

    // Event delegation: Attach listeners to Edit and Delete buttons
    table.addEventListener('click', function (event) {
        if (event.target.classList.contains('edit-btn')) {
            const id = event.target.getAttribute('data-id');
            // Fetch the record data for editing
            fetch(`/purchase-record/${id}`)
                .then(response => response.json())
                .then(data => {
                    console.log('Fetched record for editing:', data);
                    console.log('Fetched Buyer Name:', data.buyer_name);
                    console.log('Fetched Buyer ID:', data.buyer_id);  // Log the buyer_id

                    document.getElementById('purchase-date').value = data.purchase_date;
                    document.getElementById('buyer-name').value = data.buyer_name || "N/A";
                    document.getElementById('buyer-filter').value = data.buyer_id;
                    document.getElementById('quantity').value = data.weight_sold;
                    document.getElementById('rate').value = data.price_per_kg;
                    document.getElementById('paid-amount').value = data.paid_amount;
                    document.getElementById('unpaid-amount').value = data.unpaid_amount;
                    document.getElementById('total-price').value = data.total_price;
                    document.getElementById('purchase-id').value = id;
                    document.getElementById('buyer-name').disabled = true; // Disable the Buyer Name field
                    document.getElementById('edit-form').style.display = 'block'; // Show the modal
                                 
                    // Disable the Buyer Name field for editing
                    document.getElementById('buyer-name').disabled = true;

                    // Recalculate the Price and Unpaid Amount when Quantity or Rate is changed
                    updatePriceAndUnpaidAmount();
                })
                .catch(err => console.error('Error fetching purchase data:', err));
        }

        if (event.target.classList.contains('delete-btn')) {
            const id = event.target.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this record?')) {
                fetch(`/purchase-record/delete/${id}`, {
                    method: 'DELETE',
                })
                    .then(response => response.json())
                    .then(data => {
                        alert('Purchase record deleted successfully');
                        location.reload(); // Refresh the table
                    })
                    .catch(error => console.error('Error deleting purchase record:', error));
            }
        }
    });

    // Recalculate the Price and Unpaid Amount when any of the fields change
    document.getElementById('quantity').addEventListener('input', updatePriceAndUnpaidAmount);
    document.getElementById('rate').addEventListener('input', updatePriceAndUnpaidAmount);
    document.getElementById('paid-amount').addEventListener('input', updateUnpaidAmount);

    function updatePriceAndUnpaidAmount() {
        const quantity = parseFloat(document.getElementById('quantity').value) || 0;
        const rate = parseFloat(document.getElementById('rate').value) || 0;
        const price = quantity * rate;

        document.getElementById('total-price').value = price.toFixed(2); // Set the Price (Quantity * Rate)

        updateUnpaidAmount(); // Recalculate Unpaid Amount whenever Price is updated
    }

    function updateUnpaidAmount() {
        const price = parseFloat(document.getElementById('total-price').value) || 0;
        const paidAmount = parseFloat(document.getElementById('paid-amount').value) || 0;
        const unpaidAmount = price - paidAmount;

        document.getElementById('unpaid-amount').value = unpaidAmount.toFixed(2); // Set the Unpaid Amount (Price - Paid Amount)
    }



    // Close the modal when the "close" button is clicked
    document.getElementById('close-btn').addEventListener('click', function () {
        document.getElementById('edit-form').style.display = 'none'; // Hide the modal
    });


    // Update the purchase record when the Update Purchase button is clicked
    document.getElementById('update-btn').addEventListener('click', function () {
        const id = document.getElementById('purchase-id').value;
        const buyer_id = document.getElementById('buyer-filter').value;
        const purchase_date = document.getElementById('purchase-date').value;
        const quantity = document.getElementById('quantity').value;
        const rate = document.getElementById('rate').value;
        const paid_amount = document.getElementById('paid-amount').value;
        const unpaid_amount = document.getElementById('unpaid-amount').value;
        const total_price = document.getElementById('total-price').value;

        const updatedPurchase = {
            id: id,
            buyer_id: buyer_id,
            purchase_date: purchase_date,
            weight_sold: quantity,
            price_per_kg: rate,
            paid_amount: paid_amount,
            unpaid_amount: unpaid_amount,
            total_price: total_price
        };

        // Send the PUT request to update the record
        fetch('/purchase-record/update', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedPurchase)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Purchase record updated successfully');
                location.reload();
            } else {
                alert('Failed to update purchase record');
            }
        })
        .catch(error => console.error('Error updating purchase record:', error));
    });
});

// Format date to dd-mm-yyyy
function formatDate(dateString) {
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
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
