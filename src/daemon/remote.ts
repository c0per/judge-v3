import { URL } from 'url';
import { globalConfig as Cfg } from './config';
import winston = require('winston');
import { JudgeTask } from './interface/judgeTask';
import EventWebSocket from '../websocket';
import {
    JudgeStateStatus,
    CaseStatus,
    CaseState
} from '../daemon/interface/judgeTask';

let webSocketConnection: EventWebSocket;
let cancelCurrentPull: Function;

export async function connect() {
    const webSocketUrl = new URL('judge', Cfg.serverUrl).toString();
    winston.verbose(`Connect to WebSocket "${webSocketUrl}"...`);
    webSocketConnection = new EventWebSocket(webSocketUrl);

    webSocketConnection.on('close', () => {
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
            };

            webSocketConnection.once('onTask', async (payload: any) => {
                // After cancelled, a new pull is emitted while socket's still disconnected.
                if (cancelled) return;

                try {
                    winston.verbose('onTask.');
                    // ack
                    webSocketConnection.emit('ackonTask', {});
                    await handle({
                        ...payload,
                        judgeState: {
                            ...payload.judgeState,
                            setStatus,
                            getStatus
                        }
                    } as JudgeTask);
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

export async function reportProgress(task: JudgeTask) {
    winston.verbose('Reporting progress', task);
    webSocketConnection.emit('reportProgress', {
        token: Cfg.serverToken,
        judgeTask: task
    });
}

export async function reportResult() {
    winston.verbose('Reporting result');
    webSocketConnection.emit('reportResult', Cfg.serverToken);
}

// helper functions for JudgeState

function setStatus(s: JudgeStateStatus) {
    switch (s) {
        case JudgeStateStatus.CompileError:
        case JudgeStateStatus.NoTestdata:
        case JudgeStateStatus.SystemError:
        case JudgeStateStatus.Unknown:
            this.subtasks.map((sub) =>
                sub.testcases.map(
                    (c) => (c.caseStatus = CaseStatus.SystemError)
                )
            );
        // fall through
        default:
            this.status = s;
    }
}

function getStatus() {
    const cases = this.subtasks.reduce(
        (prev: CaseState[], curr) => prev.concat(curr.testcases),
        []
    );
    if (cases.every((c) => c.caseStatus === CaseStatus.Accepted)) {
        this.status = JudgeStateStatus.Accepted;
        return;
    }

    for (const c of cases) {
        switch (c.caseStatus) {
            case CaseStatus.WrongAnswer:
            case CaseStatus.PartiallyCorrect:
            case CaseStatus.MemoryLimitExceeded:
            case CaseStatus.TimeLimitExceeded:
            case CaseStatus.OutputLimitExceeded:
            case CaseStatus.FileError:
            case CaseStatus.RuntimeError:
            case CaseStatus.JudgementFailed:
            case CaseStatus.InvalidInteraction:
            case CaseStatus.SystemError:
                this.status = c.caseStatus as unknown as JudgeStateStatus;
                break;

            case CaseStatus.Pending:
            case CaseStatus.Judging:
                this.status = JudgeStateStatus.SystemError;
        }
    }

    if (this.status === JudgeStateStatus.Judging)
        this.status = JudgeStateStatus.SystemError;
}
