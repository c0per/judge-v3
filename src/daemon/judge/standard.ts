import { Test, TestCase } from '../interface/test';
import {
    TaskStatus,
    ErrorType,
    TestcaseDetails,
    CompilationResult,
    JudgeResult,
    TestcaseResult,
    StandardRunTask,
    StandardRunResult,
    RPCTaskType,
    TestcaseResultType
} from '../../interfaces';
import { globalConfig as Cfg } from '../config';
import { compile } from './compile';
import { languages, getLanguage } from '../../languages';
import { runTask } from '../rmq';
import { JudgerBase } from './judger-base';
import { mongo } from '../index';
import winston = require('winston');
import { CaseDetail, CaseState, CaseStatus } from '../interface/judgeTask';
import { ParserError } from 'redis';
import { RSA_NO_PADDING } from 'constants';

export class StandardJudger extends JudgerBase {
    spjExecutableName: string = null;
    userCodeExecuableName: string = null;
    lang: string;
    code: string;

    constructor(testData: Test, priority: number, lang: string, code: string) {
        super(testData, priority);

        this.lang = lang;
        this.code = code;
    }

    async preprocessTestData(): Promise<void> {
        if (this.testData.spj) {
            winston.verbose('Compiling special judge.');
            const lang = languages.find(
                (l) => l.name === this.testData.spj.lang
            );
            if (!lang) throw new Error('Unknown SPJ Language');
            const [spjExecutableName, spjResult] = await compile(
                this.testData.spj.code,
                lang,
                null,
                this.priority
            );
            if (spjResult.status !== TaskStatus.Done) {
                winston.verbose('Special judge CE: ' + spjResult.message);
                let message = null;
                if (spjResult.message != null && spjResult.message !== '') {
                    message =
                        '===== Special Judge Compilation Message =====' +
                        spjResult.message;
                }
                throw new Error(message);
            } else {
                this.spjExecutableName = spjExecutableName;
            }
        } else {
            this.spjExecutableName = null;
        }
    }

    async compile(): Promise<CompilationResult> {
        const language = getLanguage(this.lang);
        const [executableName, compilationResult] = await compile(
            this.code,
            language,
            [], // TODO: this.testData.extraSourceFiles[language.name],
            this.priority
        );
        this.userCodeExecuableName = executableName;
        compilationResult.status;
        return compilationResult;
    }

    async judgeTestcase(
        curCase: TestCase,
        started: () => Promise<void>
    ): Promise<CaseState> {
        winston.debug(
            `judge case: input ${curCase.input}, output ${curCase.output}, prefix ${curCase.prefix}`
        );
        const task: StandardRunTask = {
            testDataName: curCase.prefix,
            inputData: curCase.input, // fileId
            answerData: curCase.output, // fileId
            time: this.testData.limit.timeLimit,
            memory: this.testData.limit.memoryLimit,
            // TODO:
            // fileIOInput: this.parameters.fileIOInput,
            // fileIOOutput: this.parameters.fileIOOutput,
            userExecutableName: this.userCodeExecuableName,
            spjExecutableName: this.spjExecutableName
        };

        const [inputContent, outputContent, runResult]: [
            string,
            string,
            StandardRunResult
        ] = await Promise.all([
            mongo.readFileIdByLength(curCase.input, Cfg.dataDisplayLimit),
            mongo.readFileIdByLength(curCase.output, Cfg.dataDisplayLimit),
            runTask(
                { type: RPCTaskType.RunStandard, task: task },
                this.priority,
                started
            )
        ]);

        return {
            prefix: curCase.prefix,
            caseStatus: CaseStatus[TestcaseResultType[runResult.result]],
            detail: {
                time: runResult.time,
                memory: runResult.memory,
                input: inputContent,
                output: outputContent,
                // scoringRate: runResult.scoringRate,
                userOutput: runResult.userOutput,
                userError: runResult.userError,
                spjMessage: runResult.spjMessage,
                systemMessage: runResult.systemMessage
            }
        };
    }
}
