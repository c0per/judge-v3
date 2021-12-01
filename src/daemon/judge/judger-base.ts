import { Test, SubtaskScoringType, TestCase, Subtask } from '../interface/test';
import { CompilationResult, JudgeResult, TaskStatus, SubtaskResult, TestcaseDetails } from '../../interfaces';
import winston = require('winston');
import { CaseDetail, CaseState, CaseStatus, JudgeTask, SubtaskState } from '../interface/judgeTask';

function calculateSubtaskScore(scoringType: 'sum' | 'mul' | 'min', scores: number[]): number {
    switch (scoringType) {
        case 'sum':
            return scores.reduce((prev, curr) => prev + curr, 0) / scores.length;
        case 'min':
            return Math.min(...scores);
        case 'mul':
            return scores.reduce((prev, curr) => prev * curr, 1);
    }
}

export abstract class JudgerBase {
    priority: number;
    testData: Test;

    constructor(t: Test, p: number) {
        this.priority = p;
        this.testData = t;
    }

    async preprocessTestData(): Promise<void> { }

    abstract compile(): Promise<CompilationResult>;

    async judge(task: JudgeTask, reportProgress: (t: JudgeTask) => Promise<void>): Promise<JudgeTask> {
        const updateSubtaskScore = (subtaskIndex: number) => {
            const subtask = task.judgeState.subtasks[subtaskIndex];
            if (!subtask || !this.testData.subtasks[subtaskIndex]) return;
            if (subtask.testcases.some(c => c.caseStatus !== CaseStatus.Accepted)) {
                // If any testcase has failed, the score is 0.
                subtask.score = 0;
            } else {
                subtask.score = calculateSubtaskScore(
                    this.testData.subtasks[subtaskIndex].type,
                    subtask.testcases.map(
                        c => (c.caseStatus === CaseStatus.Accepted ? 1 : 0) * this.testData.subtasks[subtaskIndex].score
                    )
                );
            }
        }

        const testcaseDetailsCache: Map<string, CaseState> = new Map();
        const judgeTestcaseWrapper = async (curCase: TestCase, started: () => Promise<void>): Promise<CaseState> => {
            if (testcaseDetailsCache.has(curCase.prefix)) {
                return testcaseDetailsCache.get(curCase.prefix);
            }

            const result: CaseState = await this.judgeTestcase(curCase, started);
            testcaseDetailsCache.set(curCase.prefix, result);
            return result;
        }

        for (let subtaskIndex = 0; subtaskIndex < this.testData.subtasks.length; subtaskIndex++) {
            updateSubtaskScore(subtaskIndex);
        }

        winston.debug(`Totally ${task.judgeState.subtasks.length} subtasks.`);

        const judgeTasks: Promise<void>[] = [];
        for (let subtaskIndex = 0; subtaskIndex < this.testData.subtasks.length; subtaskIndex++) {
            const currentResult = task.judgeState.subtasks[subtaskIndex];
            const currentTask = this.testData.subtasks[subtaskIndex];
            const updateCurrentSubtaskScore = () => updateSubtaskScore(subtaskIndex);

            judgeTasks.push((async () => {
                // Type minimum and multiply is skippable, run one by one
                if (currentTask.type !== 'sum') {
                    let skipped: boolean = false;
                    for (let index = 0; index < currentTask.cases.length; index++) {
                        const currentCaseResult = currentResult.testcases[index];
                        if (skipped) {
                            currentCaseResult.caseStatus = CaseStatus.Skipped;
                        } else {
                            winston.verbose(`Judging ${subtaskIndex}, case ${index}.`);
                            let score = 0;
                            try {
                                const caseState = await judgeTestcaseWrapper(currentTask.cases[index], async () => {
                                    currentCaseResult.caseStatus = CaseStatus.Judging;
                                    await reportProgress(task);
                                });
                                currentResult.testcases[index] = caseState;
                            } catch (err) {
                                currentCaseResult.caseStatus = CaseStatus.SystemError;
                                currentCaseResult.errorMessage = err.toString();
                                winston.warn(`Task runner error: ${err.toString()} (subtask ${subtaskIndex}, case ${index})`);
                            }
                            if (score == null || isNaN(score) || score === 0) {
                                winston.debug(`Subtask ${subtaskIndex}, case ${index}: zero, skipping the rest.`);
                                skipped = true;
                            }
                            updateCurrentSubtaskScore();
                            await reportProgress(task);
                        }
                    }
                } else {
                    // Non skippable, run all immediately
                    const caseTasks: Promise<void>[] = [];
                    for (let index = 0; index < currentTask.cases.length; index++) {
                        caseTasks.push((async () => {
                            const currentCaseResult = currentResult.testcases[index];
                            winston.verbose(`Judging ${subtaskIndex}, case ${index}.`);
                            try {
                                const caseState = await judgeTestcaseWrapper(currentTask.cases[index], async () => {
                                    currentCaseResult.caseStatus = CaseStatus.Judging;
                                    await reportProgress(task);
                                });
                                currentResult.testcases[index] = caseState;
                            } catch (err) {
                                currentCaseResult.caseStatus = CaseStatus.SystemError;
                                currentCaseResult.errorMessage = err.toString();
                                winston.warn(`Task runner error: ${err.toString()} (subtask ${subtaskIndex}, case ${index})`);
                            }
                            updateCurrentSubtaskScore();
                            await reportProgress(task);
                        })());
                    }
                    await Promise.all(caseTasks);
                }
                updateCurrentSubtaskScore();
                winston.verbose(`Subtask ${subtaskIndex}, finished`);
            })());
        }
        await Promise.all(judgeTasks);
        return task;
    }

    protected abstract judgeTestcase(curCase: TestCase, started: () => Promise<void>): Promise<CaseState>;

    async cleanup() { }
}
