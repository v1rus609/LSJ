document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const successPopup = document.getElementById('success-popup');
    const form = document.querySelector('form');
    const submitButton = form.querySelector('button[type="submit"]');
    const weightInput = document.getElementById('weight');

    // ✅ **Show success popup if redirected with message**
    if (urlParams.get('message')) {
        successPopup.style.display = 'block';
        setTimeout(() => {
            successPopup.style.display = 'none';
        }, 3000);
    }

    // ✅ **Function to format numbers while allowing decimals**
    function formatNumberWithCommas(value) {
        // Remove any existing commas
        let rawValue = value.replace(/,/g, '');

        // Allow valid numbers with up to 2 decimal places
        if (!isNaN(rawValue) && rawValue !== '') {
            let [integer, decimal] = rawValue.split('.');
            integer = parseInt(integer, 10).toLocaleString('en-US'); // Add commas to the integer part
            return decimal !== undefined ? `${integer}.${decimal}` : integer;
        }
        return value;
    }

    // ✅ **Allow only valid numbers & one decimal point**
    weightInput.addEventListener('input', (event) => {
        let value = weightInput.value.replace(/[^0-9.]/g, ''); // Allow only numbers and decimals

        // **Ensure only ONE decimal point is allowed**
        const decimalCount = (value.match(/\./g) || []).length;
        if (decimalCount > 1) {
            value = value.slice(0, -1);  // Remove extra decimal points
        }

        // ✅ **Apply formatting while keeping decimals**
        weightInput.value = formatNumberWithCommas(value);
    });

    // ✅ **Remove commas for editing when user clicks the field**
    weightInput.addEventListener('focus', () => {
        weightInput.value = weightInput.value.replace(/,/g, '');
    });

    // ✅ **Reapply formatting when user leaves the input field**
    weightInput.addEventListener('blur', () => {
        weightInput.value = formatNumberWithCommas(weightInput.value);
    });

    // ✅ **Prevent Double Submission**
    form.addEventListener('submit', (event) => {
        event.preventDefault();  // Prevent default form submission

        // 🔒 **Disable Submit Button to Prevent Multiple Clicks**
        submitButton.disabled = true;

        // ✅ **Ensure raw number (without commas) is sent to the backend**
        weightInput.value = weightInput.value.replace(/,/g, '');

        // ✅ **Submit the form manually after fixing the data**
        form.submit();
    });
});

// ✅ **Dropdown Menu Handling**
document.addEventListener("DOMContentLoaded", function() {
    const dropdownButton = document.querySelector(".dropbtn");
    const dropdownContent = document.querySelector(".dropdown-content");

    // ✅ **Toggle dropdown menu**
    dropdownButton.addEventListener("click", function(event) {
        event.stopPropagation();
        dropdownContent.style.display = dropdownContent.style.display === "block" ? "none" : "block";
    });

    // ✅ **Hide dropdown when clicking elsewhere**
    document.addEventListener("click", function() {
        dropdownContent.style.display = "none";
    });
});
