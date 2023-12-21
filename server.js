const express = require('express');
const WebSocket = require('ws');
const app = express();
const port = 3000;

const cors = require('cors');
app.use(cors());


class OcppChargerSimulator {
    constructor(chargerId, centralSystemUrl, heartbeatInterval) {
        this.chargerId = chargerId;
        this.centralSystemUrl = centralSystemUrl;
        this.heartbeatInterval = heartbeatInterval;
        this.websocket = new WebSocket(`${centralSystemUrl}/${chargerId}`, 'ocpp1.6');
        this.currentTransactionId = null;
        this.currentIdTag = null;
        this.meterValueInterval = null;

        this.websocket.on('open', () => this.onConnected());
        this.websocket.on('message', (message) => this.onMessage(message));
        this.websocket.on('close', () => console.log(`Charger ${chargerId} disconnected`));
        this.websocket.on('error', (error) => console.error('WebSocket Error:', error));
    }

    powerOff() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        if (this.websocket) {
            this.websocket.close();
        }
        console.log(`Charger ${this.chargerId} powered off.`);
    }
    
    powerOn() {
        if (!this.websocket || this.websocket.readyState === WebSocket.CLOSED) {
            this.websocket = new WebSocket(`${this.centralSystemUrl}/${this.chargerId}`, 'ocpp1.6');
            this.websocket.on('open', () => this.onConnected());
            this.websocket.on('message', (message) => this.onMessage(message));
            this.websocket.on('close', () => console.log(`Charger ${this.chargerId} disconnected`));
            this.websocket.on('error', (error) => console.error('WebSocket Error:', error));
        } else {
            console.log(`Charger ${this.chargerId} is already powered on.`);
        }
    }

    onConnected() {
        console.log(`Charger ${this.chargerId} connected to central system`);
        this.sendBootNotification();
    }

    sendBootNotification() {
        const bootNotificationPayload = {
            chargeBoxSerialNumber: "simulator-" + this.chargerId,
            chargePointModel: "Virtual Charger",
            chargePointSerialNumber: this.chargerId,
            chargePointVendor: "Rudra",
            firmwareVersion: "1.0"
        };
        const message = JSON.stringify([2, this.generateUniqueId(), 'BootNotification', bootNotificationPayload]);
        this.websocket.send(message);
        console.log(`BootNotification sent from charger ${this.chargerId}`);
    }

    onMessage(message) {
        const response = JSON.parse(message);
        if (response[0] === 3 && response[2] && response[2].status === 'Accepted') {
            console.log(`BootNotification accepted by central system.`);
            this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatInterval);
            this.sendStatusNotification('Available');
        } else if (response[0] === 3 && response[1] && response[2] && response[2].transactionId) {
            // Save the transactionId when starting a transaction
            this.currentTransactionId = response[2].transactionId;
            console.log(`Transaction started with ID: ${this.currentTransactionId}`);
        }
        console.log(`Message received from central system: ${message}`);
    }

    sendHeartbeat() {
        const message = JSON.stringify([2, this.generateUniqueId(), 'Heartbeat', {}]);
        this.websocket.send(message);
        console.log(`Heartbeat sent from charger ${this.chargerId}`);
    }

    sendStatusNotification(status) {
        const statusNotificationPayload = {
            connectorId: 0,
            errorCode: 'NoError',
            status: status,
            timestamp: new Date().toISOString()
        };
        const message = JSON.stringify([2, this.generateUniqueId(), 'StatusNotification', statusNotificationPayload]);
        this.websocket.send(message);
        console.log(`StatusNotification sent from charger ${this.chargerId} with status ${status}`);
    }

    startTransaction(idTag) {
        this.currentIdTag = idTag; // Save the idTag for the current transaction
        const startTransactionPayload = {
          connectorId: 1,
          idTag: idTag,
          meterStart: 0,
          timestamp: new Date().toISOString(),
        };
        const message = JSON.stringify([2, this.generateUniqueId(), 'StartTransaction', startTransactionPayload]);
        this.websocket.send(message);
        console.log(`StartTransaction sent from charger ${this.chargerId} with idTag ${idTag}`);

        // Send a StatusNotification for starting the transaction
        this.sendStatusNotification('Charging');
    }

    sendMeterValues() {
        if (!this.currentTransactionId) {
            console.log('No transaction active to send meter values for.');
            return;
        }

        // Assuming these are constants for now, these can be dynamically changed later
        const voltage = 208; // Volts
        const current = 32;  // Amps

        // Calculate power (W) using P = V * I
        const power = voltage * current; // Watts

        // Assuming we send meter values every 20 seconds
        const energyIncrement = (power * (20 / 3600)); // Convert power to Wh for 20 seconds

        // If meterStart is not defined, initialize it with some starting value.
        this.meterStart = this.meterStart ?? 0;
        this.meterStart += energyIncrement; // Increment the energy

        const meterValuesPayload = {
            connectorId: 1,
            transactionId: this.currentTransactionId,
            meterValue: [
                {
                    timestamp: new Date().toISOString(),
                    sampledValue: [
                        {
                            value: this.meterStart.toFixed(1), // Wh
                            context: 'Sample.Periodic',
                            format: 'Raw',
                            measurand: 'Energy.Active.Import.Register',
                            location: 'Outlet',
                            unit: 'Wh'
                        },
                        {
                            value: current.toFixed(1), // A
                            context: 'Sample.Periodic',
                            format: 'Raw',
                            measurand: 'Current.Import',
                            location: 'Outlet',
                            unit: 'A'
                        },
                        {
                            value: voltage.toFixed(1), // V
                            context: 'Sample.Periodic',
                            format: 'Raw',
                            measurand: 'Voltage',
                            location: 'Outlet',
                            unit: 'V'
                        },
                        {
                            value: power.toFixed(1), // W
                            context: 'Sample.Periodic',
                            format: 'Raw',
                            measurand: 'Power.Active.Import',
                            location: 'Outlet',
                            unit: 'W'
                        }
                    ]
                }
            ]
        };
        const message = JSON.stringify([2, this.generateUniqueId(), 'MeterValues', meterValuesPayload]);
        this.websocket.send(message);
        console.log(`MeterValues sent from charger ${this.chargerId} for transactionId ${this.currentTransactionId}`);
    }

    stopTransaction() {
        if (!this.currentTransactionId || !this.currentIdTag) {
            console.log('No transaction active to stop.');
            return;
        }
        const stopTransactionPayload = {
            transactionId: this.currentTransactionId,
            idTag: this.currentIdTag,
            meterStop: this.meterStart, // Replace with the actual meter value
            timestamp: new Date().toISOString(),
            reason: 'EVDisconnected'
        };
        const message = JSON.stringify([2, this.generateUniqueId(), 'StopTransaction', stopTransactionPayload]);
        this.websocket.send(message);
        console.log(`StopTransaction sent from charger ${this.chargerId} for transactionId ${this.currentTransactionId}`);
        
        // Reset the transaction state
        this.currentTransactionId = null;
        this.currentIdTag = null;

        // Send a StatusNotification for finishing the transaction
        this.sendStatusNotification('Finishing');

        // Clear the meter values interval
        if (this.meterValueInterval) {
            clearInterval(this.meterValueInterval);
            this.meterValueInterval = null;
        }

        // Send a StatusNotification for available again after some time
        setTimeout(() => {
            this.sendStatusNotification('Available');
        }, 5000); // Wait 5 seconds before sending Available status
    }

    generateUniqueId() {
        return `msg${Math.random().toString(16).substr(2, 8)}`;
    }
}

const chargers = {};

app.get('/start-charger/:chargerId', (req, res) => {
    const chargerId = req.params.chargerId;

    if (chargers[chargerId]) {
        return res.status(400).send('Charger already exists');
    }

    const centralSystemUrl = 'ws://centralsystem.hypercharge.com/ocpp'; // Replace with your central system URL
    const heartbeatInterval = 10000; // Heartbeat interval in milliseconds (e.g., 10000 for 10 seconds)
    const charger = new OcppChargerSimulator(chargerId, centralSystemUrl, heartbeatInterval);

    chargers[chargerId] = charger; // Store the charger instance

    res.send(`Started charger simulation for charger ID: ${chargerId}`);
});

// Endpoint to simulate starting a transaction
app.get('/chargers/:chargerId/start-transaction', (req, res) => {
    const chargerId = req.params.chargerId;
    const idTag = req.query.idTag; // Expect an idTag as query parameter
  
    if (!chargers[chargerId]) {
        return res.status(404).send('Charger not found');
    }
  
    chargers[chargerId].startTransaction(idTag);

    // Start sending meter values every 20 seconds (as an example)
    chargers[chargerId].meterValueInterval = setInterval(() => {
        chargers[chargerId].sendMeterValues();
    }, 20000); // Change the interval as needed

    res.send(`Transaction started for charger ID: ${chargerId} with idTag: ${idTag}`);
});
  
// Endpoint to simulate stopping a transaction
app.get('/chargers/:chargerId/stop-transaction', (req, res) => {
    const chargerId = req.params.chargerId;
  
    if (!chargers[chargerId]) {
        return res.status(404).send('Charger not found');
    }
  
    chargers[chargerId].stopTransaction();
    res.send(`Transaction stopped for charger ID: ${chargerId}`);
});

// Endpoint to delete a charger
app.delete('/chargers/:chargerId', (req, res) => {
    const chargerId = req.params.chargerId;
    if (!chargers[chargerId]) {
        return res.status(404).send('Charger not found');
    }
    chargers[chargerId].powerOff();
    delete chargers[chargerId];
    res.send(`Charger ${chargerId} deleted`);
});

// Endpoint to toggle the power state of a charger
app.post('/chargers/:chargerId/power', (req, res) => {
    const chargerId = req.params.chargerId;
    const action = req.body.action; // Expect 'on' or 'off' as the action

    if (!chargers[chargerId]) {
        return res.status(404).send('Charger not found');
    }

    if (action === 'on') {
        chargers[chargerId].powerOn();
    } else if (action === 'off') {
        chargers[chargerId].powerOff();
    } else {
        return res.status(400).send('Invalid action');
    }
    res.send(`Power ${action} for charger ${chargerId}`);
});

app.get('/chargers', (req, res) => {
    // Convert charger objects to a simpler representation if needed
    const chargerList = Object.keys(chargers).map((id) => ({
        id: id,
        isConnected: chargers[id].isConnected, // Example property
        // ... include other properties you want to send
    }));
    res.json(chargerList);
});

app.get('/get-chargers', (req, res) => {
    // This should return an array of charger objects
    // For example, you might have stored charger data in an in-memory object or a database
    // Replace the following line with your actual logic to retrieve charger data
    res.json(Object.values(chargers));
});



app.listen(port, () => {
    console.log(`OCPP Charger Simulator running on http://localhost:${port}`);
});
