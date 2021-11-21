import * as url from 'url';
import { globalConfig as Cfg } from './config';
import winston = require('winston');
import { ProgressReportData } from '../interfaces';
import { JudgeTask } from './interfaces';
import EventWebSocket from '../websocket';
import WebSocket = require('ws');

let webSocketConnection: EventWebSocket;
let cancelCurrentPull: Function;

export async function connect() {
    const webSocketUrl = url.resolve(Cfg.serverUrl, 'judge');
    winston.verbose(`Connect to WebSocket "${webSocketUrl}"...`);
    webSocketConnection = new EventWebSocket(new WebSocket(webSocketUrl));

    webSocketConnection.on('disconnect', () => {
        winston.verbose(`Disconnected from WebSocket "${webSocketUrl}"...`);
        if (cancelCurrentPull) cancelCurrentPull();
    });
}

export async function disconnect() {
    webSocketConnection.close();
}

export async function waitForTask(handle: (task: JudgeTask) => Promise<void>) {
    while (true) {
        winston.verbose('Waiting for new task...');
        await new Promise<void>((resolve, reject) => {
            // This should be cancelled if socket disconnects.
            let cancelled = false;
            cancelCurrentPull = () => {
                cancelled = true;
                winston.verbose('Cancelled task polling since disconnected.');
                resolve();
            }

            webSocketConnection.once('onTask', async (payload: any) => {
                // After cancelled, a new pull is emitted while socket's still disconnected.
                if (cancelled) return;

                try {
                    winston.verbose('onTask.');
                    await handle(payload);
                    // ack
                    webSocketConnection.emit('ackonTask', {});
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });

            webSocketConnection.emit('waitForTask', Cfg.serverToken);
        });
    }
}

// Difference between result and progress:
// The `progress' is to be handled by *all* frontend proxies and pushed to all clients.
// The `result' is to be handled only *once*, and is to be written to the database.

export async function reportProgress(data: ProgressReportData) {
    winston.verbose('Reporting progress', data);
    webSocketConnection.emit('reportProgress', {token: Cfg.serverToken, data});
}

export async function reportResult(data: ProgressReportData) {
    winston.verbose('Reporting result', data);
    webSocketConnection.emit('reportResult', {token: Cfg.serverToken, data});
}
