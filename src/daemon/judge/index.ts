import winston = require('winston');
import rmq = require('../rmq');

import type { Test } from '../interfaces';
import { JudgeTaskContent, JudgeTask, ProblemType } from '../interfaces';
import { StandardJudger } from './standard';
import { JudgerBase } from './judger-base';
import { JudgeResult, ErrorType, OverallResult, CompilationResult, TaskStatus, ProgressReportType } from '../../interfaces';
import { readRulesFile } from '../testData';
import { filterPath } from '../../utils';
import { AnswerSubmissionJudger } from './submit-answer';
import { InteractionJudger } from './interaction';
import { mongo } from '../index';

export async function judge(
    task: JudgeTask,
    // extraData: Buffer,
    reportProgress: (p: OverallResult) => Promise<void>,
    reportCompileProgress: (p: CompilationResult) => Promise<void>
): Promise<OverallResult> {
    winston.verbose(`Judging ${task.taskId}`);
    // Parse test data
    let testData: Test = null;
    try {
        winston.debug(`Fetching Testdata for ${task.taskId}...`);
        testData = await mongo.getTest(task.pid);
    } catch (err) {
        winston.info(`Error reading test data for ${task.taskId}`, err);
        return { error: ErrorType.TestDataError, systemMessage: `An error occurred while parsing test data: ${err.toString()}` };
    }

    let judger: JudgerBase = new StandardJudger(testData, task.priority, task.lang, task.code);
    console.log("Task type: standard");

    // todo: support answer submission and interaction
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
        return { error: ErrorType.TestDataError, systemMessage: err.toString() };
    }

    winston.debug(`Compiling...`);
    const compileResult = await judger.compile();
    winston.debug(`Reporting compilation progress...`);
    await reportCompileProgress(compileResult);
    if (compileResult.status !== TaskStatus.Done) {
        winston.verbose(`Compilation error: ${compileResult.message}`);
        return {
            compile: compileResult
        };
    }
    winston.debug(`Judging...`);
    const judgeResult = await judger.judge(r => reportProgress({ compile: compileResult, judge: r }));
    
    await judger.cleanup();
    return { compile: compileResult, judge: judgeResult };
}