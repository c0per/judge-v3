import winston = require('winston');
import { Test } from '../interface/test';
import { ProblemType } from '../interface/test';
import { JudgeState, JudgeStateStatus, JudgeTask } from '../interface/judgeTask';
import { StandardJudger } from './standard';
import { JudgerBase } from './judger-base';
import { JudgeResult, ErrorType, OverallResult, CompilationResult, TaskStatus } from '../../interfaces';
// TODO: add support for :
// import { AnswerSubmissionJudger } from './submit-answer';
// import { InteractionJudger } from './interaction';

import { mongo } from '../index';

export async function judge(
    task: JudgeTask,
    // extraData: Buffer,
    reportProgress: (p: JudgeTask) => Promise<void>
): Promise<JudgeTask> {
    winston.verbose(`Judging ${task.taskId}`);
    // Parse test data
    let testData: Test = null;
    try {
        winston.debug(`Fetching Testdata for ${task.taskId} for pid ${task.pid}...`);
        testData = await mongo.getTest(task.pid);
    } catch (err) {
        winston.info(`Error reading test data for ${task.taskId}`, err);
        task.judgeState.status = JudgeStateStatus.NoTestdata;
        task.judgeState.errorMessage = err.toString();
        return task;
    }

    let judger: JudgerBase = new StandardJudger(testData, task.priority, task.lang, task.code);
    console.log("Task type: standard");

    /*if (task.type === ProblemType.Standard) {
        judger = new StandardJudger(testData, task.param as StandardJudgeParameter, task.priority);
    } else if (task.type === ProblemType.AnswerSubmission) {
        judger = new AnswerSubmissionJudger(testData, extraData, task.priority);
    } else if (task.type === ProblemType.Interaction) {
        judger = new InteractionJudger(testData, task.param as InteractionJudgeParameter, task.priority);
    } else {
        throw new Error(`Task type not supported`);
    }*/

    try {
        winston.debug(`Preprocessing testdata for ${task.taskId}...`);
        await judger.preprocessTestData();
    } catch (err) {
        winston.verbose(`Test data ${task.taskId} err`, err);
        task.judgeState.status = JudgeStateStatus.NoTestdata;
        task.judgeState.errorMessage = err.toString();
        return task;
    }

    winston.debug(`Compiling...`);
    const compileResult = await judger.compile();
    winston.debug(`Reporting compilation progress...`);
    if (compileResult.status !== TaskStatus.Done) {
        winston.verbose(`Compilation error: ${compileResult.message}`);
        task.judgeState.status = JudgeStateStatus.CompileError;
        task.judgeState.errorMessage = compileResult.message;
        return task;
    } else {
        task.judgeState.status = JudgeStateStatus.Judging;
        await reportProgress(task);
    }
    winston.debug(`Judging...`);
    await judger.judge(task, reportProgress);
    
    await judger.cleanup();
    return task;
}