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

    constructor(socket: WebSocket) {
        this.socket = socket;
        this.socket.onmessage = (rawEv) => {
            console.log(rawEv.data);
            
            const payload = decode(rawEv.data as any) as [string, any];
            this.dispatchEvent(payload[0], payload[1]);
        };
        this.socket.onopen = () => {
            this.dispatchEvent('open', undefined);
        };
        this.socket.onclose = () => {
            this.dispatchEvent('close', undefined);
        };
        this.socket.onerror = () => {
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
