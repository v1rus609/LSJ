// ✅ Helper function to format numbers with commas and prevent NaN issues
function formatNumberWithCommas(value) {
    if (isNaN(value) || value === null) return "0"; // ✅ Prevents NaN display
    return parseFloat(value).toLocaleString('en-US');
}

const metrics = [];
let currentMetric = 0;

// ✅ Fetch metrics from the backend and ensure no missing values
function fetchMetrics() {
    // Check if the user is logged in
    fetch('/check-role')
        .then(response => response.json())
        .then(data => {
            if (!data.loggedIn) {
                // If not logged in, redirect to login page
                window.location.href = '/login.html';
            } else {
                // If logged in, fetch the dashboard metrics
                console.log("📊 User logged in. Fetching metrics...");
                fetch('/dashboard-metrics')
                    .then(response => response.json())
                    .then(data => {
                        console.log("📊 Fetched Metrics:", data); // ✅ Debugging log

                        metrics.push(
                            { value: data.net_sale || 0, label: 'Net Sales', type: 'sell' }, // ✅ Ensure Net Sales is valid
                            { value: data.total_paid || 0, label: 'Total Paid', type: 'paid' }, // ✅ Ensure Total Paid is valid
                            { value: data.total_unpaid || 0, label: 'Total Unpaid', type: 'unpaid' }, // ✅ FIXED: Corrected Unpaid Value
                            { value: data.total_remaining_weight || 0, label: 'Remaining Weight', type: 'weight' }, // Add Remaining Weight metric
                            { value: data.total_buyers || 0, label: 'Total Buyers', type: 'buyers' },
                            { value: data.total_containers || 0, label: 'Total Containers', type: 'containers' }
                        );
                        updateMetric();
                    })
                    .catch(error => {
                        console.error('❌ Error fetching metrics:', error);
                        document.getElementById('metric-value').textContent = 'Error';
                        document.getElementById('metric-label').textContent = 'Loading Metrics';
                    });
            }
        })
        .catch(error => {
            console.error('❌ Error checking session:', error);
            window.location.href = '/login.html'; // If there's an error in checking session, redirect to login
        });
}

// ✅ Update the displayed metric
function updateMetric() {
    const metricDisplay = document.getElementById('metric-display');
    const metricValue = document.getElementById('metric-value');
    const metricLabel = document.getElementById('metric-label');

    if (metrics.length === 0) {
        metricValue.textContent = "Loading...";
        metricLabel.textContent = "Fetching Data";
        return;
    }

    const current = metrics[currentMetric];

    // 🚀 Add a transition effect
    metricDisplay.setAttribute('data-changing', 'true');

    // Force height to prevent layout shifts
    metricValue.style.minHeight = metricValue.offsetHeight + "px";
    metricLabel.style.minHeight = metricLabel.offsetHeight + "px";

    setTimeout(() => {
        metricValue.textContent = formatNumberWithCommas(current.value);
        metricLabel.textContent = current.label;
        metricDisplay.setAttribute('data-type', current.type);

        metricDisplay.removeAttribute('data-changing');
    }, 200);
}

// ✅ Navigate to the next metric
function nextMetric() {
    currentMetric = (currentMetric + 1) % metrics.length;
    updateMetric();
}

// ✅ Navigate to the previous metric
function prevMetric() {
    currentMetric = (currentMetric - 1 + metrics.length) % metrics.length;
    updateMetric();
}

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

// ✅ Initialize metrics on page load
fetchMetrics();
