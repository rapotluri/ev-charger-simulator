const express = require('express');
const WebSocket = require('ws');
const app = express();
const port = 3000;

class OcppChargerSimulator {
    constructor(chargerId, centralSystemUrl, heartbeatInterval) {
        this.chargerId = chargerId;
        this.centralSystemUrl = centralSystemUrl;
        this.heartbeatInterval = heartbeatInterval;
        this.websocket = new WebSocket(`${centralSystemUrl}/${chargerId}`, 'ocpp1.6');

        this.websocket.on('open', () => this.onConnected());
        this.websocket.on('message', (message) => this.onMessage(message));
        this.websocket.on('close', () => console.log(`Charger ${chargerId} disconnected`));
        this.websocket.on('error', (error) => console.error('WebSocket Error:', error));
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
        const startTransactionPayload = {
          connectorId: 1, // Assuming only one connector for the simulation
          idTag: idTag,
          meterStart: 0,
          timestamp: new Date().toISOString(),
        };
        const message = JSON.stringify([2, this.generateUniqueId(), 'StartTransaction', startTransactionPayload]);
        this.websocket.send(message);
        console.log(`StartTransaction sent from charger ${this.chargerId} with idTag ${idTag}`);
    }
    
    stopTransaction(transactionId) {
        const stopTransactionPayload = {
          transactionId: transactionId,
          idTag: "SampleTag", // Replace with actual tag if needed
          meterStop: 1337, // Replace with the actual meter value
          timestamp: new Date().toISOString(),
          reason: 'EVDisconnected'
        };
        const message = JSON.stringify([2, this.generateUniqueId(), 'StopTransaction', stopTransactionPayload]);
        this.websocket.send(message);
        console.log(`StopTransaction sent from charger ${this.chargerId} for transactionId ${transactionId}`);
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
    res.send(`Transaction started for charger ID: ${chargerId} with idTag: ${idTag}`);
});
  
// Endpoint to simulate stopping a transaction
app.get('/chargers/:chargerId/stop-transaction', (req, res) => {
    const chargerId = req.params.chargerId;
    const transactionId = req.query.transactionId; // Expect a transactionId as query parameter
  
    if (!chargers[chargerId]) {
      return res.status(404).send('Charger not found');
    }
  
    chargers[chargerId].stopTransaction(transactionId);
    res.send(`Transaction stopped for charger ID: ${chargerId} with transactionId: ${transactionId}`);
});

app.listen(port, () => {
    console.log(`OCPP Charger Simulator running on http://localhost:${port}`);
});
