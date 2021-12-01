import winston = require('winston');
import { globalConfig as Cfg } from './config';
import util = require('util');
import rmq = require('./rmq');
import remote = require('./remote');
import Mongo from '../mongo';
import { judge } from './judge';
import { SerializedBuffer } from '../interfaces';
import {
    CaseState,
    CaseStatus,
    JudgeStateStatus,
    JudgeTask
} from './interface/judgeTask';

export const mongo: Mongo = new Mongo(Cfg.mongodbUrl, Cfg.mongodbName);

(async function () {
    winston.info('Daemon starts.');
    await remote.connect();
    await rmq.connect();
    await mongo.connect();
    winston.info('Start consuming the queue.');
    await remote.waitForTask(async (task: JudgeTask) => {
        // TODO: task.extraData
        /*if (task.extraData) {
            const extraData: SerializedBuffer = task.extraData as any as SerializedBuffer;
            if (extraData.type === "Buffer") task.extraData = new Buffer(extraData.data);
        }*/

        let result: JudgeTask;
        try {
            result = await judge(task, async (task: JudgeTask) => {
                await remote.reportProgress(task);
            });
        } catch (err) {
            winston.warn(`Judge error!!! TaskId: ${task.taskId}`, err);
            task.judgeState.status = JudgeStateStatus.SystemError;
            task.judgeState.errorMessage = `An error occurred.\n${err.toString()}`;
        }
        console.log('done judging');
        task = postProcess(task);
        await remote.reportProgress(task);
        await remote.reportResult();
    });
})().then(
    () => {
        winston.info('Initialization logic completed.');
    },
    (err) => {
        winston.error(util.inspect(err));
        process.exit(1);
    }
);

const postProcess = (task: JudgeTask): JudgeTask => {
    const cases = task.judgeState.subtasks.reduce(
        (prev: CaseState[], curr) => prev.concat(curr.testcases),
        []
    );
    if (cases.every((c) => c.caseStatus === CaseStatus.Accepted)) {
        task.judgeState.status = JudgeStateStatus.Accepted;
        return task;
    }

    for (const c of cases) {
        switch (c.caseStatus) {
            case CaseStatus.WrongAnswer:
                task.judgeState.status = JudgeStateStatus.WrongAnswer;
                break;
            case CaseStatus.PartiallyCorrect:
                task.judgeState.status = JudgeStateStatus.PartiallyCorrect;
                break;
            case CaseStatus.MemoryLimitExceeded:
                task.judgeState.status = JudgeStateStatus.MemoryLimitExceeded;
                break;
            case CaseStatus.TimeLimitExceeded:
                task.judgeState.status = JudgeStateStatus.TimeLimitExceeded;
                break;
            case CaseStatus.OutputLimitExceeded:
                task.judgeState.status = JudgeStateStatus.OutputLimitExceeded;
                break;
            case CaseStatus.FileError:
                task.judgeState.status = JudgeStateStatus.FileError;
                break;
            case CaseStatus.RuntimeError:
                task.judgeState.status = JudgeStateStatus.RuntimeError;
                break;
            case CaseStatus.JudgementFailed:
                task.judgeState.status = JudgeStateStatus.JudgementFailed;
                break;
            case CaseStatus.InvalidInteraction:
                task.judgeState.status = JudgeStateStatus.InvalidInteraction;
                break;
            case CaseStatus.SystemError:
                task.judgeState.status = JudgeStateStatus.SystemError;
                break;
        }
    }

    if (task.judgeState.status === JudgeStateStatus.Judging)
        task.judgeState.status = JudgeStateStatus.SystemError;
    return task;
};
