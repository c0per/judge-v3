import winston = require('winston');
import { encode, decode } from 'msgpack-lite';
import WebSocket = require('ws');

export default class EventWebSocket {
    socket: WebSocket;
    callbacks: Record<string, { callback: Function; once: boolean }[]> = {};

    get readyState() {
        return this.socket.readyState;
    }

    get connected() {
        return this.socket.readyState === 1;
    }

    constructor(socketUrl: string) {
        this.socket = new WebSocket(socketUrl);
        this.socket.onmessage = (rawEv) => {
            console.log(rawEv.data);

            const payload = decode(rawEv.data as any) as [string, any];
            this.dispatchEvent(payload[0], payload[1]);
        };
        this.socket.onopen = () => {
            winston.info('websocket opened');
            this.dispatchEvent('open', undefined);
        };
        this.socket.onclose = () => {
            winston.info('websocket closed');
            this.dispatchEvent('close', undefined);
        };
        this.socket.onerror = (e) => {
            winston.info('websocket error ' + e.message);
            this.dispatchEvent('error', undefined);
        };
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
