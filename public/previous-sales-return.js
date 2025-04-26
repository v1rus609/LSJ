document.addEventListener('DOMContentLoaded', function () {
    const buyerSelect = document.getElementById('buyer-select');
    const containerSelect = document.getElementById('container-select');
    const returnedKgInput = document.getElementById('returned-kg');
    const returnedPriceInput = document.getElementById('returned-price-per-kg');
    const totalAmountInput = document.getElementById('total-amount');
    const submitButton = document.getElementById('submit-return');

    let maxReturnableAmount = 0;

    // **Helper functions for formatting numbers**
    function formatNumberWithCommas(value) {
        let rawValue = value.replace(/,/g, '');
        if (!isNaN(rawValue) && rawValue !== '') {
            let [integer, decimal] = rawValue.split('.');
            integer = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            return decimal !== undefined ? `${integer}.${decimal}` : integer;
        }
        return value;
    }

    function getRawNumber(value) {
        return value.replace(/,/g, '');
    }

    // **Step 1: Fetch and Populate Buyers**
    function fetchBuyers() {
        fetch('/buyers/list')
            .then(response => response.json())
            .then(data => {
                buyerSelect.innerHTML = '<option value="">Select Buyer</option>';
                data.forEach(buyer => {
                    const option = document.createElement('option');
                    option.value = buyer.id;
                    option.textContent = buyer.name;
                    buyerSelect.appendChild(option);
                });
            })
            .catch(error => console.error('❌ Error fetching buyers:', error));
    }

    // **Step 2: Fetch All Containers (No need to filter by buyer)**
    buyerSelect.addEventListener('change', function () {
        const buyerId = buyerSelect.value;
        if (!buyerId) return;

fetch('/containers/all')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();  // Attempt to parse JSON if the response is ok
    })
    .then(data => {
        // Check if the data is an array before calling .forEach
        if (Array.isArray(data)) {
            console.log('Containers Data:', data);
            containerSelect.innerHTML = '<option value="">Select Container</option>';
            data.forEach(container => {
                const option = document.createElement('option');
                option.value = container.id;
                option.textContent = container.container_number;
                containerSelect.appendChild(option);
            });
        } else {
            // Log the error or handle it if the data is not an array
            console.error('Expected an array but got:', data);
        }
    })
            .catch(error => console.error('❌ Error fetching containers:', error));
    });

    // **Step 3: Restrict Return Amount & Format Input Fields**
    returnedKgInput.addEventListener('input', function () {
        let value = getRawNumber(returnedKgInput.value);
        let enteredKg = parseFloat(value) || 0;

        returnedKgInput.value = formatNumberWithCommas(value);
        calculateTotalAmount();
    });

    // Price per KG input functionality
    returnedPriceInput.addEventListener('input', function () {
        let value = getRawNumber(returnedPriceInput.value);
        returnedPriceInput.value = formatNumberWithCommas(value);
        calculateTotalAmount();
    });

    // **Step 4: Calculate Total Return Amount & Format Output**
    function calculateTotalAmount() {
        const returnedKg = parseFloat(getRawNumber(returnedKgInput.value)) || 0;
        const pricePerKg = parseFloat(getRawNumber(returnedPriceInput.value)) || 0;
        const total = returnedKg * pricePerKg;
        totalAmountInput.value = formatNumberWithCommas(total.toFixed(2));
        toggleSubmitButton();
    }

    // **Step 5: Enable/Disable Submit Button**
    function toggleSubmitButton() {
        const buyerId = buyerSelect.value;
        const containerId = containerSelect.value;
        const kgValue = getRawNumber(returnedKgInput.value);
        const priceValue = getRawNumber(returnedPriceInput.value);

        const isBuyerSelected = buyerId && buyerId !== "0";
        const isContainerSelected = containerId && containerId !== "0";
        const isKgValid = !isNaN(kgValue) && kgValue > 0;
        const isPriceValid = !isNaN(priceValue) && priceValue > 0;

        submitButton.disabled = !(isBuyerSelected && isContainerSelected && isKgValid && isPriceValid);
    }

    // **Step 6: Handle Form Submission**
    document.getElementById('previous-sales-return-form').addEventListener('submit', function (event) {
        event.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";

        const returnData = {
            return_date: document.getElementById('return-date').value,
            buyer_id: buyerSelect.value,
            container_id: containerSelect.value,
            returned_kg: parseFloat(getRawNumber(returnedKgInput.value)),
            returned_price_per_kg: parseFloat(getRawNumber(returnedPriceInput.value)),
            total_amount: parseFloat(getRawNumber(totalAmountInput.value))
        };

        fetch('/previous-sales-return', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(returnData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('✅ Previous Sales Return Submitted Successfully');
                document.getElementById('previous-sales-return-form').reset();
                toggleSubmitButton();
            } else {
                alert('❌ Error submitting return');
            }
        })
        .catch(error => {
            console.error('❌ Error:', error);
            alert('❌ An error occurred while submitting the return.');
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = "Submit Return";
        });
    });

    fetchBuyers();
});

// **Dropdown Toggle**
document.addEventListener("DOMContentLoaded", function () {
    const dropdownButton = document.querySelector(".dropbtn");
    const dropdownContent = document.querySelector(".dropdown-content");

    // Toggle dropdown visibility when button is clicked
    dropdownButton.addEventListener("click", function (event) {
        event.stopPropagation();
        dropdownContent.style.display = dropdownContent.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", function () {
        dropdownContent.style.display = "none";
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