document.addEventListener('DOMContentLoaded', function () {
    const buyerSelect = document.getElementById('buyer-select');
    const containerSelect = document.getElementById('container-select');
    const purchasedProductText = document.getElementById('purchased-product-text');
    const returnedKgInput = document.getElementById('returned-kg');
    const returnedPriceInput = document.getElementById('returned-price-per-kg');
    const totalAmountInput = document.getElementById('total-amount');
    const submitButton = document.getElementById('submit-return');
    const buyerSearch = document.getElementById('buyer-search');
    const containerSearch = document.getElementById('container-search');

    let maxReturnableAmount = 0;

    // **Helper functions for formatting numbers**
    // ✅ **Format numbers with commas while allowing decimals**
    function formatNumberWithCommas(value) {
        let rawValue = value.replace(/,/g, '');

        if (!isNaN(rawValue) && rawValue !== '') {
            let [integer, decimal] = rawValue.split('.');
            integer = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ","); // Add commas to integer part
            return decimal !== undefined ? `${integer}.${decimal}` : integer;
        }
        return value;
    }
	
    function getRawNumber(value) {
        return value.replace(/,/g, '');
    }

    function restrictInputToNumbers(event) {
        const key = event.key;
        if (!/[0-9.]/.test(key) && key !== 'Backspace' && key !== 'Delete' && key !== 'ArrowLeft' && key !== 'ArrowRight') {
            event.preventDefault();
        }

        // Prevent multiple decimal points
        if (key === '.' && event.target.value.includes('.')) {
            event.preventDefault();
        }
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

                // Apply search functionality to buyer dropdown
                buyerSearch.addEventListener('input', function () {
                    filterDropdownOptions(buyerSelect, buyerSearch.value);
                });
            })
            .catch(error => console.error("❌ Error fetching buyers:", error));
    }

    // **Step 2: Fetch Containers for Selected Buyer**
    buyerSelect.addEventListener('change', function () {
        const buyerId = this.value;
        if (!buyerId) return;

        fetch(`/buyer-containers/${buyerId}`)
            .then(response => response.json())
            .then(data => {
                containerSelect.innerHTML = '<option value="">Select Container</option>';
                data.forEach(container => {
                    const option = document.createElement('option');
                    option.value = container.container_id;
                    option.textContent = container.container_number;
                    containerSelect.appendChild(option);
                });
                purchasedProductText.textContent = '';

                // Apply search functionality to container dropdown
                containerSearch.addEventListener('input', function () {
                    filterDropdownOptions(containerSelect, containerSearch.value);
                });
            })
            .catch(error => console.error('❌ Error fetching containers:', error));
    });

    // **Step 3: Fetch Purchase Data for Selected Container**
    containerSelect.addEventListener('change', function () {
        const buyerId = buyerSelect.value;
        const containerId = this.value;
        if (!buyerId || !containerId) return;

        fetch(`/container-purchase-details/${buyerId}/${containerId}`)
            .then(response => response.json())
            .then(data => {
                const { total_purchased, total_returned } = data;
                maxReturnableAmount = total_purchased - total_returned;

                // **Show Purchased Product Info**
                purchasedProductText.textContent = `Purchased Product: ${maxReturnableAmount.toFixed(2)} kg`;

                console.log(`✅ Buyer ${buyerId} - Container ${containerId}`);
                console.log(`🔹 Purchased: ${total_purchased}, 🔻 Returned: ${total_returned}, 🟢 Net Available: ${maxReturnableAmount}`);
            })
            .catch(error => console.error('❌ Error fetching purchase details:', error));
    });

    // **Step 4: Restrict Return Amount & Format Input Fields**
    returnedKgInput.addEventListener('input', function () {
        let value = getRawNumber(returnedKgInput.value);
        let enteredKg = parseFloat(value) || 0;

        if (enteredKg >= maxReturnableAmount) {
            alert(`Error: You cannot return more than ${formatNumberWithCommas(maxReturnableAmount.toString())} kg.`);
            returnedKgInput.value = formatNumberWithCommas(maxReturnableAmount.toString());
        } else {
            returnedKgInput.value = formatNumberWithCommas(value);
        }

        calculateTotalAmount();
    });

    returnedKgInput.addEventListener('focus', () => {
        returnedKgInput.value = getRawNumber(returnedKgInput.value);
    });

    returnedKgInput.addEventListener('blur', () => {
        returnedKgInput.value = formatNumberWithCommas(returnedKgInput.value);
    });

    returnedKgInput.addEventListener('keydown', restrictInputToNumbers);

    // **Step 5: Allow Manual Price Input & Format Price Input**
    returnedPriceInput.addEventListener('input', function () {
        let value = getRawNumber(returnedPriceInput.value);
        returnedPriceInput.value = formatNumberWithCommas(value);
        calculateTotalAmount();
    });

    returnedPriceInput.addEventListener('focus', () => {
        returnedPriceInput.value = getRawNumber(returnedPriceInput.value);
    });

    returnedPriceInput.addEventListener('blur', () => {
        returnedPriceInput.value = formatNumberWithCommas(returnedPriceInput.value);
    });

    returnedPriceInput.addEventListener('keydown', restrictInputToNumbers);

    // **Step 6: Calculate Total Return Amount & Format Output**
    function calculateTotalAmount() {
        const returnedKg = parseFloat(getRawNumber(returnedKgInput.value)) || 0;
        const pricePerKg = parseFloat(getRawNumber(returnedPriceInput.value)) || 0;
        const total = returnedKg * pricePerKg;
        totalAmountInput.value = formatNumberWithCommas(total.toFixed(2));
        toggleSubmitButton();
    }

    totalAmountInput.addEventListener('focus', () => {
        totalAmountInput.value = getRawNumber(totalAmountInput.value);
    });

    totalAmountInput.addEventListener('blur', () => {
        totalAmountInput.value = formatNumberWithCommas(totalAmountInput.value);
    });

    // **Step 7: Enable/Disable Submit Button**
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

    // **Step 8: Handle Form Submission (Remove Commas)**
    document.getElementById('purchase-return-form').addEventListener('submit', function (event) {
        event.preventDefault();

        const returnData = {
            return_date: document.getElementById('return-date').value,
            buyer_id: buyerSelect.value,
            container_id: containerSelect.value,
            returned_kg: parseFloat(getRawNumber(returnedKgInput.value)),
            returned_price_per_kg: parseFloat(getRawNumber(returnedPriceInput.value)),
            total_amount: parseFloat(getRawNumber(totalAmountInput.value))
        };

        fetch('/purchase-return', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(returnData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('✅ Purchase Return Submitted Successfully');
                document.getElementById('purchase-return-form').reset();
                toggleSubmitButton();
                purchasedProductText.textContent = '';
            } else {
                alert('❌ Error submitting purchase return');
            }
        })
        .catch(error => {
            console.error('❌ Error:', error);
            alert('❌ An error occurred while submitting the return.');
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

// **Function to Filter Dropdown Options Based on Search**
function filterDropdownOptions(dropdown, searchTerm) {
    const options = dropdown.querySelectorAll('option');
    const filterValue = searchTerm.toLowerCase();
    options.forEach(function (option) {
        const text = option.textContent || option.innerText;
        if (text.toLowerCase().includes(filterValue)) {
            option.style.display = ''; // Show matching option
        } else {
            option.style.display = 'none'; // Hide non-matching option
        }
    });
}

