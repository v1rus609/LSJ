document.addEventListener('DOMContentLoaded', () => {
    const buyerDropdown = document.getElementById('buyer');
    const buyerSearchBox = document.getElementById('buyer-search-box');
    const successPopup = document.getElementById('success-popup');
    const form = document.querySelector('form');
    const discountAmountInput = document.getElementById('discount_amount');
    const submitButton = form.querySelector('button[type="submit"]'); // Get the submit button

    // Fetch buyers for the dropdown
    fetch('/buyers/list')
        .then(response => response.json())
        .then(data => {
            // Populate the dropdown with buyer names
            const populateBuyerDropdown = () => {
                // Clear the existing options except for the "Select Buyer" placeholder
                buyerDropdown.innerHTML = '<option value="" disabled selected>Select Buyer</option>';

                data.forEach(buyer => {
                    const option = document.createElement('option');
                    option.value = buyer.id;
                    option.textContent = buyer.name;
                    buyerDropdown.appendChild(option);
                });
            };

            // Initially populate the dropdown
            populateBuyerDropdown();

            // Search functionality to filter the dropdown options
            buyerSearchBox.addEventListener('input', function () {
                const searchValue = this.value.toLowerCase();

                // Filter buyers based on search input
                const filteredData = data.filter(buyer => buyer.name.toLowerCase().includes(searchValue));

                // Repopulate dropdown with filtered buyers
                buyerDropdown.innerHTML = '<option value="" disabled selected>Select Buyer</option>';  // Reset dropdown

                filteredData.forEach(buyer => {
                    const option = document.createElement('option');
                    option.value = buyer.id;
                    option.textContent = buyer.name;
                    buyerDropdown.appendChild(option);
                });
            });
        });

    // Handle form submission
    form.addEventListener('submit', (event) => {
        event.preventDefault();

        // Disable the submit button to prevent multiple submissions
        submitButton.disabled = true;

        const buyerId = buyerDropdown.value;
        const discountDate = form.discount_date.value;
        const discountAmount = parseFloat(form.discount_amount.value);

        if (!buyerId || isNaN(discountAmount)) {
            alert('Please fill all fields correctly.');
            submitButton.disabled = false; // Re-enable the button if there's an error
            return;
        }

        fetch('/discounts/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ buyer_id: buyerId, discount_date: discountDate, discount_amount: discountAmount }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                successPopup.style.display = 'block';
                setTimeout(() => {
                    successPopup.style.display = 'none';
                    location.reload(); // Reload the page after successful submission
                }, 3000);
            }
        })
        .catch(error => {
            console.error('Error adding discount:', error);
            submitButton.disabled = false; // Re-enable the button if there was an error
        });
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
