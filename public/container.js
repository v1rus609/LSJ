document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('message')) {
        const popup = document.getElementById('success-popup');
        popup.style.display = 'block';

        setTimeout(() => {
            popup.style.display = 'none';
        }, 3000);
    }

    const arrivalDateField = document.getElementById('arrival_date');
    arrivalDateField.addEventListener('change', (event) => {
        const selectedDate = new Date(event.target.value);
        const formattedDate = new Intl.DateTimeFormat('en-GB').format(selectedDate);
        console.log(`Formatted Date: ${formattedDate}`);
    });

    const weightInput = document.getElementById('weight');

    // Function to add commas for display
    function formatNumberWithCommas(value) {
        // Remove existing commas
        const rawValue = value.replace(/,/g, '');

        // Return formatted number if valid
        return !isNaN(rawValue) && rawValue !== '' ? parseFloat(rawValue).toLocaleString('en-US') : value;
    }

    // Restrict input and format with commas dynamically
    weightInput.addEventListener('input', () => {
        // Remove invalid characters
        let value = weightInput.value.replace(/[^0-9.,]/g, '');

        // Add commas for display
        weightInput.value = formatNumberWithCommas(value);
    });

    weightInput.addEventListener('focus', () => {
        // Remove commas for editing
        weightInput.value = weightInput.value.replace(/,/g, '');
    });

    weightInput.addEventListener('blur', () => {
        // Add commas again on blur
        weightInput.value = formatNumberWithCommas(weightInput.value);
    });

    // Remove commas before form submission
    const form = document.querySelector('form');
    form.addEventListener('submit', (event) => {
        // Ensure raw value (without commas) is sent to the backend
        weightInput.value = weightInput.value.replace(/,/g, '');
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
