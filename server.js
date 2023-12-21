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

    generateUniqueId() {
        return `msg${Math.random().toString(16).substr(2, 8)}`;
    }
}

app.get('/start-charger/:chargerId', (req, res) => {
    const chargerId = req.params.chargerId;
    const centralSystemUrl = 'ws://centralsystem.hypercharge.com/ocpp'; // Replace with your central system URL
    const heartbeatInterval = 10000; // Heartbeat interval in milliseconds (e.g., 10000 for 10 seconds)
    new OcppChargerSimulator(chargerId, centralSystemUrl, heartbeatInterval);
    res.send(`Started charger simulation for charger ID: ${chargerId}`);
});

app.listen(port, () => {
    console.log(`OCPP Charger Simulator running on http://localhost:${port}`);
});
