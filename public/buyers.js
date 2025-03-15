let buyerData = []; // Store fetched buyer data for filtering

// ✅ **Function for displaying numbers in the table (Fixed decimal places)**
function formatTableNumber(value) {
    if (value === null || value === undefined || value === '') {
        return '0.00'; // Default display value
    }

    const num = parseFloat(value.toString().replace(/,/g, '')); // Remove commas before parsing
    if (isNaN(num)) return value; // Return original value if not a number

    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ✅ **Function to format numbers while allowing decimals**
function formatInputNumber(value) {
    if (!value) return ''; // Return empty if value is empty

    let rawValue = value.replace(/,/g, ''); // Remove commas
    if (isNaN(rawValue)) return value; // If not a number, return original value

    let [integer, decimal] = rawValue.split('.'); // Split integer and decimal parts
    integer = parseInt(integer, 10).toLocaleString('en-US'); // Add commas to integer part

    return decimal !== undefined ? `${integer}.${decimal}` : integer; // Keep decimals if they exist
}

// ✅ **Ensure valid number format before submission (removes commas)**
function getRawNumber(value) {
    return value ? value.toString().replace(/,/g, '') : ''; // Ensure valid string before replacing
}

// ✅ **Fetch buyers and populate the table**
fetch('/buyers/list')
    .then(response => {
        if (!response.ok) throw new Error('Failed to fetch buyer data.');
        return response.json();
    })
    .then(data => {
        buyerData = data;
        renderTable(buyerData);
    })
    .catch(error => {
        console.error('❌ Error fetching buyers:', error);
        document.getElementById('error-message').style.display = 'block';
    });

// ✅ **Delete a buyer**
function deleteBuyer(buyerId) {
    if (confirm('Are you sure you want to delete this buyer?')) {
        fetch(`/buyers/delete/${buyerId}`, { method: 'DELETE' })
            .then(response => {
                if (!response.ok) throw new Error(`Failed to delete buyer. Status: ${response.status}`);
                return response.text();
            })
            .then(message => {
                alert(message);
                location.reload();
            })
            .catch(error => {
                console.error('❌ Error deleting buyer:', error);
                alert('Failed to delete buyer. Please try again.');
            });
    }
}

// ✅ **Render Table with Fixed Decimal Formatting**
function renderTable(data) {
    const tableBody = document.getElementById('buyer-list');
    tableBody.innerHTML = ''; 

    data.forEach(buyer => {
        const row = `
            <tr>
                <td>${buyer.id}</td>
                <td>${buyer.name}</td>
                <td>${buyer.location}</td>
                <td>${buyer.contact_number}</td>
                <td>${formatTableNumber(buyer.opening_balance)}</td> <!-- ✅ Prevents null error -->
                <td>
				<button class="delete-btn" onclick="deleteBuyer(${buyer.id})"><span class="delete-text">Delete</span><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}

// ✅ **Filter buyers based on search input**
document.getElementById('search-box').addEventListener('input', function () {
    const searchValue = this.value.toLowerCase();
    const filteredData = buyerData.filter(buyer =>
        buyer.name.toLowerCase().includes(searchValue) ||
        buyer.location.toLowerCase().includes(searchValue)
    );
    renderTable(filteredData);
});

// ✅ **Opening Balance Input Field: Add Separate Formatting**
document.addEventListener('DOMContentLoaded', function () {
    const openingBalanceInput = document.getElementById('opening-balance');

    if (openingBalanceInput) {
        openingBalanceInput.addEventListener('input', function () {
            this.value = formatInputNumber(this.value); // Format with commas dynamically
        });

        openingBalanceInput.addEventListener('focus', function () {
            this.value = getRawNumber(this.value); // Remove commas while editing
        });

        openingBalanceInput.addEventListener('blur', function () {
            this.value = formatInputNumber(this.value); // Re-add commas when leaving the field
        });
    }

    // ✅ **Ensure correct format before submitting the form**
    const buyerForm = document.querySelector('form');
    if (buyerForm) {
        buyerForm.addEventListener('submit', function () {
            openingBalanceInput.value = getRawNumber(openingBalanceInput.value); // Send raw number
        });
    }
});

// ✅ **Handle dropdown visibility**
document.addEventListener("DOMContentLoaded", function () {
    const dropdownButton = document.querySelector(".dropbtn");
    const dropdownContent = document.querySelector(".dropdown-content");

    dropdownButton.addEventListener("click", function (event) {
        event.stopPropagation();
        dropdownContent.style.display = dropdownContent.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", function () {
        dropdownContent.style.display = "none";
    });
});
