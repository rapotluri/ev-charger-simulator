document.getElementById('addChargerBtn').addEventListener('click', addCharger);

function addCharger() {
    const chargerName = document.getElementById('chargerNameInput').value;
    fetch('https://scaling-funicular-xxvpwv97rgpcp9xw-3000.app.github.dev/chargers', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: chargerName }),
    })
    .then(response => response.json())
    .then(charger => {
        updateChargerListUI(charger);
        document.getElementById('chargerNameInput').value = ''; // Clear input field
    })
    .catch(error => console.error('Error:', error));
}

function startTransaction(chargerId) {
    fetch(`https://scaling-funicular-xxvpwv97rgpcp9xw-3000.app.github.dev/chargers/${chargerId}/start`, { method: 'POST' })
    .then(response => response.text())
    .then(result => console.log(result))
    .catch(error => console.error('Error:', error));
}

function stopTransaction(chargerId) {
    fetch(`https://scaling-funicular-xxvpwv97rgpcp9xw-3000.app.github.dev/chargers/${chargerId}/stop`, { method: 'POST' })
    .then(response => response.text())
    .then(result => console.log(result))
    .catch(error => console.error('Error:', error));
}

function removeCharger(chargerId) {
    fetch(`https://scaling-funicular-xxvpwv97rgpcp9xw-3000.app.github.dev/chargers/${chargerId}`, { method: 'DELETE' })
    .then(response => response.text())
    .then(result => {
        console.log(result);
        document.querySelectorAll('#chargersList .list-group-item').forEach(item => {
            if (item.textContent.includes(chargerId)) {
                item.remove();
            }
        });
    })
    .catch(error => console.error('Error:', error));
}

function updateChargerListUI(charger) {
    const chargersList = document.getElementById('chargersList');
    const listItem = document.createElement('li');
    listItem.classList.add('list-group-item');
    listItem.innerHTML = `
        <span>${charger.id}</span>
        <div class="charger-actions">
            <button class="btn btn-sm btn-info" onclick="startTransaction('${charger.id}')">Start Transaction</button>
            <button class="btn btn-sm btn-warning" onclick="stopTransaction('${charger.id}')">Stop Transaction</button>
            <button class="btn btn-sm btn-danger" onclick="removeCharger('${charger.id}')">Remove</button>
        </div>
    `;
    chargersList.appendChild(listItem);
}

// Add any additional functions or logic you need
