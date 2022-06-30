import winston = require('winston');
import { globalConfig as Cfg } from './config';
import util = require('util');
import rmq = require('./rmq');
import remote = require('./remote');
import Mongo from '../mongo';
import { judge } from './judge';
import { SerializedBuffer } from '../interfaces';
import {
    JudgeStateStatus,
    JudgeTask,
    getStatus,
    setStatus,
    getScore
} from './interface/judgeTask';
import { getJSDocReadonlyTag } from 'typescript';

export const mongo: Mongo = new Mongo(Cfg.mongodbUrl, Cfg.mongodbName, Cfg.mongodbUsername, Cfg.mongodbPassword);

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

        try {
            await judge(task, async (task: JudgeTask) => {
                await remote.reportProgress(task);
            });
        } catch (err) {
            winston.warn(`Judge error!!! TaskId: ${task.taskId}`, err);
            setStatus(task.judgeState, JudgeStateStatus.SystemError);
            task.judgeState.errorMessage = `An error occurred.\n${err.toString()}`;
        }
        console.log('done judging');
        postProcess(task);
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

const postProcess = (task: JudgeTask) => {
    getStatus(task.judgeState);
    getScore(task);
};
