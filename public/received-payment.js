// Fetch and populate buyers in the dropdown
fetch('/buyers/list')
    .then(response => response.json())
    .then(data => {
        const buyerDropdown = document.getElementById('buyer-dropdown');
        data.forEach(buyer => {
            const option = document.createElement('option');
            option.value = buyer.id;
            option.text = buyer.name;
            buyerDropdown.appendChild(option);
        });
    })
    .catch(error => console.error('Error fetching buyers:', error));

// Fetch and display buyer's unpaid balance when a buyer is selected
document.getElementById('buyer-dropdown').addEventListener('change', function () {
    const buyerId = this.value;
    if (!buyerId) return;

fetch(`/buyers/unpaid-amount/${buyerId}`)
    .then(response => response.json())
    .then(data => {
        console.log('📊 Unpaid Amount from Backend:', data.unpaid_amount); // Debugging Log
        const unpaidAmount = data.unpaid_amount || 0;
        document.getElementById('unpaid-amount').textContent = formatNumberWithCommas(unpaidAmount);
        document.getElementById('payment-amount').setAttribute('data-max-amount', unpaidAmount);
    })
        .catch(error => console.error('Error fetching unpaid amount:', error));
});

// Toggle the "Particulars" field based on payment method
document.getElementById('payment-method').addEventListener('change', function () {
    const particularsField = document.getElementById('particulars');
    if (this.value === 'bank') {
        particularsField.disabled = false;
        particularsField.required = true;
    } else {
        particularsField.disabled = true;
        particularsField.required = false;
        particularsField.value = '';
    }
});

// Helper functions for formatting and raw number handling
function formatNumberWithCommas(value) {
    return parseFloat(value).toLocaleString('en-US');
}

function getRawNumber(value) {
    return value.replace(/,/g, '');
}

// Restrict input to numbers, commas, and dots
document.getElementById('payment-amount').addEventListener('keypress', function (event) {
    const char = String.fromCharCode(event.which);
    if (!/[0-9.,]/.test(char)) {
        event.preventDefault();
    }
});


document.getElementById('payment-amount').addEventListener('focus', function () {
    this.value = getRawNumber(this.value);
});

document.getElementById('payment-amount').addEventListener('blur', function () {
    const rawValue = getRawNumber(this.value);
    this.value = formatNumberWithCommas(rawValue);
});

// Handle form submission
document.getElementById('payment-form').addEventListener('submit', function (event) {
    event.preventDefault();

    // Get form values
    const buyerDropdown = document.getElementById('buyer-dropdown');
    const buyerId = buyerDropdown.value;
    const buyerName = buyerDropdown.options[buyerDropdown.selectedIndex].text;
    const paymentDate = document.getElementById('payment-date').value;
    const paymentMethod = document.getElementById('payment-method').value;
    const paymentAmount = parseFloat(getRawNumber(document.getElementById('payment-amount').value));
    const maxAmount = parseFloat(document.getElementById('payment-amount').getAttribute('data-max-amount')) || 0;
    const particulars = paymentMethod === 'bank' ? document.getElementById('particulars').value : null;

    // Validate inputs
    if (!buyerId || !paymentDate || !paymentMethod || !paymentAmount || paymentAmount <= 0) {
        alert('Please fill out all fields with valid values.');
        return;
    }

    if (paymentMethod === 'bank' && !particulars) {
        alert('Please provide particulars for bank payments.');
        return;
    }

    // Submit payment distribution request
    fetch('/payments/history/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            buyer_id: buyerId,
            buyer_name: buyerName,
            payment_date: paymentDate,
            payment_method: paymentMethod,
            cash_amount: paymentMethod === 'cash' ? paymentAmount : 0,
            bank_amount: paymentMethod === 'bank' ? paymentAmount : 0,
            particulars,
        }),
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Payment processing failed.');
            }
            return response.json();
        })
        .then(() => {
            // Show success message
            const popup = document.getElementById('success-popup');
            popup.style.display = 'block';
            setTimeout(() => {
                popup.style.display = 'none';
                window.location.reload();
            }, 3000);
        })
        .catch(error => {
            alert('Error: ' + error.message);
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