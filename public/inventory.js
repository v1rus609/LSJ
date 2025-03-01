let buyerData = [];
let containerData = [];

// Helper functions for formatting and raw number handling
function formatNumberWithCommas(value) {
    const rawValue = value.replace(/,/g, '');
    return !isNaN(rawValue) && rawValue !== '' ? parseFloat(rawValue).toLocaleString('en-US') : value;
}

function getRawNumber(value) {
    return value.replace(/,/g, '');
}

// Restrict input to numbers, dot, and comma
function restrictInputToNumbers(event) {
    const key = event.key;
    if (!/[0-9.,]/.test(key) && key !== 'Backspace' && key !== 'Delete' && key !== 'ArrowLeft' && key !== 'ArrowRight') {
        event.preventDefault();
    }
}

// Fetch buyers to populate the dropdown
fetch('/buyers/list')
    .then(response => response.json())
    .then(data => {
        buyerData = data;
        renderBuyerDropdown(buyerData);
    })
    .catch(error => console.error('Error fetching buyers:', error));

// Render buyer dropdown
function renderBuyerDropdown(data) {
    const buyerDropdown = document.getElementById('buyer-dropdown');
    buyerDropdown.innerHTML = '<option value="">Select a Buyer</option>';
    data.forEach(buyer => {
        const option = document.createElement('option');
        option.value = buyer.id;
        option.text = `${buyer.name} (${buyer.location})`;
        buyerDropdown.appendChild(option);
    });
}

// Filter buyers
document.getElementById('buyer-search').addEventListener('input', function () {
    const query = this.value.toLowerCase();
    const filteredBuyers = buyerData.filter(buyer =>
        buyer.name.toLowerCase().includes(query) ||
        buyer.location.toLowerCase().includes(query)
    );
    renderBuyerDropdown(filteredBuyers);
});

// Fetch containers to populate dropdowns
fetch('/containers/list')
    .then(response => response.json())
    .then(data => {
        containerData = data;
        document.querySelectorAll('.container-dropdown').forEach(dropdown => {
            renderContainerDropdown(dropdown, containerData);
        });
    })
    .catch(error => console.error('Error fetching containers:', error));

// Render container dropdown
function renderContainerDropdown(dropdown, data) {
    dropdown.innerHTML = '<option value="">Select a Container</option>';
    data.forEach(container => {
        const option = document.createElement('option');
        option.value = container.id;
        option.setAttribute('data-remaining-weight', container.remaining_weight);
        option.textContent = `${container.container_number} (Remaining: ${container.remaining_weight} kg)`;
        dropdown.appendChild(option);
    });
}

// Filter containers
function handleContainerSearch(searchBox) {
    const dropdown = searchBox.closest('.container-group')?.querySelector('.container-dropdown');

    if (!dropdown || dropdown.tagName !== 'SELECT') {
        console.error("Dropdown element not found or is not a <select> tag.");
        return;
    }

    const searchQuery = searchBox.value.toLowerCase();
    const filteredContainers = containerData.filter(container =>
        container.container_number.toLowerCase().includes(searchQuery)
    );

    renderContainerDropdown(dropdown, filteredContainers);
}

document.getElementById('container-section').addEventListener('input', (event) => {
    if (event.target.classList.contains('container-search')) {
        handleContainerSearch(event.target);
    }
});

// Format fields dynamically without affecting calculations
const fieldsToFormat = [
    '.weight-sold',
    '.price-per-kg',
    '.paid-amount'
];

fieldsToFormat.forEach(selector => {
    document.addEventListener('input', (event) => {
        if (event.target.matches(selector)) {
            event.target.value = formatNumberWithCommas(event.target.value);
        }
    });

    document.addEventListener('focus', (event) => {
        if (event.target.matches(selector)) {
            event.target.value = getRawNumber(event.target.value);
        }
    });

    document.addEventListener('blur', (event) => {
        if (event.target.matches(selector)) {
            event.target.value = formatNumberWithCommas(event.target.value);
        }
    });

    // Add restriction for allowed characters
    document.querySelectorAll(selector).forEach(field => {
        field.addEventListener('keydown', restrictInputToNumbers);
    });
});

// ** Weight Limit Restriction **
document.getElementById('container-section').addEventListener('input', (event) => {
    if (event.target.classList.contains('weight-sold')) {
        const weightInput = event.target;
        const containerDropdown = weightInput.closest('.container-group').querySelector('.container-dropdown');
        const selectedOption = containerDropdown.options[containerDropdown.selectedIndex];

        if (selectedOption) {
            const remainingWeight = parseFloat(selectedOption.getAttribute('data-remaining-weight')) || 0;
            const enteredWeight = parseFloat(getRawNumber(weightInput.value)) || 0;

            if (enteredWeight > remainingWeight) {
                alert(`Error: You cannot sell more than the remaining weight (${remainingWeight} kg).`);
                weightInput.value = formatNumberWithCommas(remainingWeight.toString());
            }
        }
    }
});

// Calculate totals
function calculateTotals() {
    const weightInputs = document.querySelectorAll('.weight-sold');
    const priceInputs = document.querySelectorAll('.price-per-kg');
    const paidInputs = document.querySelectorAll('.paid-amount');
    const unpaidInputs = document.querySelectorAll('.unpaid-amount');
    let totalPrice = 0;

    weightInputs.forEach((weightInput, index) => {
        const weight = parseFloat(getRawNumber(weightInput.value)) || 0;
        const pricePerKg = parseFloat(getRawNumber(priceInputs[index].value)) || 0;
        const paidAmount = parseFloat(getRawNumber(paidInputs[index].value)) || 0;
        const totalContainerPrice = weight * pricePerKg;
        const unpaidAmount = totalContainerPrice - paidAmount;

        unpaidInputs[index].value = formatNumberWithCommas(unpaidAmount.toFixed(2));
        totalPrice += totalContainerPrice;
    });

    document.getElementById('total-price').value = formatNumberWithCommas(totalPrice.toFixed(2));
}

document.getElementById('container-section').addEventListener('input', (event) => {
    if (event.target.classList.contains('weight-sold') ||
        event.target.classList.contains('price-per-kg') ||
        event.target.classList.contains('paid-amount')) {
        calculateTotals();
    }
});

// Add or remove container groups
document.getElementById('container-section').addEventListener('click', (event) => {
    if (event.target.classList.contains('add-container')) {
        const containerSection = document.getElementById('container-section');
        const newGroup = document.createElement('div');
        newGroup.className = 'container-group';
        newGroup.innerHTML = `
            <label>Select Container:</label><br>
            <input type="text" class="container-search" placeholder="Search Container..."><br><br>
            <select name="container_id[]" class="container-dropdown" required>
                <option value="">Select a Container</option>
            </select><br><br>
            <label>Weight Sold (KG):</label><br>
            <input type="text" name="weight_sold[]" class="weight-sold" required><br><br>
            <label>Price Per KG:</label><br>
            <input type="text" name="price_per_kg[]" class="price-per-kg" required><br><br>
            <label>Paid Amount:</label><br>
            <input type="text" name="paid_amount[]" class="paid-amount" required><br><br>
            <label>Unpaid Amount:</label><br>
            <input type="text" name="unpaid_amount[]" class="unpaid-amount" readonly><br><br>
            <button type="button" class="add-container">Add Container</button>
            <button type="button" class="remove-container">Remove</button><br><br>`;
        containerSection.appendChild(newGroup);

        // Populate dropdown with full container list
        const dropdown = newGroup.querySelector('.container-dropdown');
        renderContainerDropdown(dropdown, containerData);
    } else if (event.target.classList.contains('remove-container')) {
        const containerGroup = event.target.closest('.container-group');
        if (containerGroup) {
            containerGroup.remove();
        }
    }
});

// Form submission with double-click prevention
document.getElementById('sell-form').addEventListener('submit', (event) => {
    event.preventDefault();

    // Get the "Sell" button and disable it to prevent multiple clicks
    const sellButton = document.querySelector('button[type="submit"]');
    sellButton.disabled = true;  // 🔒 Disable the button

    const formData = new FormData(event.target);
    const data = {
        buyer_id: formData.get('buyer_id'),
        purchase_date: formData.get('purchase_date'),
        container_id: formData.getAll('container_id[]'),
        weight_sold: formData.getAll('weight_sold[]').map(getRawNumber),
        price_per_kg: formData.getAll('price_per_kg[]').map(getRawNumber),
        paid_amount: formData.getAll('paid_amount[]').map(getRawNumber),
        unpaid_amount: formData.getAll('unpaid_amount[]').map(getRawNumber),
    };

    fetch('/containers/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to sell product.');
        }
        return response.text();
    })
    .then(() => {
        const popup = document.getElementById('success-popup');
        popup.style.display = 'block';
        setTimeout(() => {
            popup.style.display = 'none';
            window.location.reload();
        }, 3000);
    })
    .catch(error => {
        console.error('❌ Error during form submission:', error);
        alert('Error: ' + error.message);
    })
    .finally(() => {
        // ✅ Re-enable the button after request completes
        setTimeout(() => {
            sellButton.disabled = false;
        }, 3000);  // Prevents immediate re-clicking
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
