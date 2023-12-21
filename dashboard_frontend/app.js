document.getElementById('addChargerBtn').addEventListener('click', addCharger);

function addCharger() {
    const chargerName = document.getElementById('chargerNameInput').value;
    fetch(`http://localhost:3000/start-charger/${chargerName}`)
        .then(response => response.text())
        .then(result => {
            console.log(result);
            addChargerToList(chargerName);
            document.getElementById('chargerName').value = ''; // Clear input field
        })
        .catch(error => console.error('Error:', error));
        
    if (chargerName) {
        // Simulate adding charger (replace with actual server request)
        updateChargerListUI({ id: chargerName, status: 'Disconnected' });
        document.getElementById('chargerNameInput').value = ''; // Clear input
    }
}

function updateChargerListUI(charger) {
    const chargersList = document.getElementById('chargersList');
    const listItem = document.createElement('li');
    listItem.classList.add('list-group-item');
    listItem.innerHTML = `
        <span>${charger.id}</span>
        <span class="badge badge-${charger.status === 'Connected' ? 'success' : 'secondary'}">${charger.status}</span>
        <div class="charger-actions">
            <button class="btn btn-sm btn-info" onclick="startTransaction('${charger.id}')">Start Transaction</button>
            <button class="btn btn-sm btn-warning" onclick="stopTransaction('${charger.id}')">Stop Transaction</button>
            <button class="btn btn-sm btn-danger" onclick="removeCharger('${charger.id}')">Remove</button>
        </div>
    `;
    chargersList.appendChild(listItem);
}

function startTransaction(chargerId) {
    console.log(`Starting transaction for ${chargerId}`);
    // Add code to handle start transaction
}

function stopTransaction(chargerId) {
    console.log(`Stopping transaction for ${chargerId}`);
    // Add code to handle stop transaction
}

function removeCharger(chargerId) {
    console.log(`Removing charger ${chargerId}`);
    // Add code to handle charger removal
    document.querySelectorAll('#chargersList .list-group-item').forEach(item => {
        if (item.textContent.includes(chargerId)) {
            item.remove();
        }
    });
}
