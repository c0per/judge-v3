import winston = require('winston');
import { encode, decode } from 'msgpack-lite';
import WebSocket = require('ws');

export default class EventWebSocket {
    socket: WebSocket;
    url: string;
    callbacks: Record<string, { callback: Function; once: boolean }[]> = {};
    retryTimer?: NodeJS.Timer;

    get readyState() {
        // 3 is closed
        return this.socket.readyState;
    }

    get connected() {
        return this.readyState === 1;
    }

    initSocket() {
        this.socket.onmessage = (rawEv) => {
            console.log(rawEv.data);

            const payload = decode(rawEv.data as any) as [string, any];
            this.dispatchEvent(payload[0], payload[1]);
        };

        this.socket.onopen = () => {
            if (this.retryTimer) {
                clearInterval(this.retryTimer);
                this.retryTimer = undefined;
            }

            winston.info('websocket opened');
            this.dispatchEvent('open', undefined);
        };

        this.socket.onclose = () => {
            this.retryTimer = setInterval(() => this.reconnect(), 1000);

            winston.info('websocket closed');
            this.dispatchEvent('close', undefined);
        };

        this.socket.onerror = (e) => {
            winston.info('websocket error ' + e.message);
            this.dispatchEvent('error', undefined);
        };
    }

    constructor(socketUrl: string) {
        this.url = socketUrl;
        this.socket = new WebSocket(socketUrl);
        this.initSocket();
    }

    reconnect() {
        // connection closed
        if (this.readyState === 3) {
            this.socket = new WebSocket(this.url);
            this.initSocket();
        }
    }

    on(event: string, cb: Function): this {
        this.callbacks[event] = this.callbacks[event] || [];
        this.callbacks[event].push({ callback: cb, once: false });
        return this;
    }

    once(event: string, cb: Function): this {
        this.callbacks[event] = this.callbacks[event] || [];
        this.callbacks[event].push({ callback: cb, once: true });
        return this;
    }

    emit(event: string, payload: any): this {
        this.socket.send(encode([event, payload]));
        return this;
    }

    dispatchEvent(event: string, payload: any) {
        if (this.callbacks[event]) {
            for (const cb of this.callbacks[event]) {
                cb.callback(payload);
            }
            this.callbacks[event] = this.callbacks[event].filter(
                (cb) => !cb.once
            );
        }
    }

    close() {
        this.socket.close();
    }
}
