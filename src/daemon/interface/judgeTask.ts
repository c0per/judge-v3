type taskId = string;

export enum JudgeStateStatus {
    // case status
    Accepted = 'Accepted',
    WrongAnswer = 'Wrong Answer',
    PartiallyCorrect = 'Partially Correct',
    MemoryLimitExceeded = 'Memory Limit Exceeded',
    TimeLimitExceeded = 'Time Limit Exceeded',
    OutputLimitExceeded = 'Output Limit Exceeded',
    FileError = 'File Error',
    RuntimeError = 'Runtime Error',
    JudgementFailed = 'Judgement Failed',
    InvalidInteraction = 'Invalid Interaction',

    // judge status
    CompileError = 'Compile Error',
    NoTestdata = 'No Testdata',
    SystemError = 'System Error',
    Unknown = 'Unknown',

    // processing status
    // the judge task in in the queue
    Waiting = 'Waiting',
    // the judge has begun but not finished
    Pending = 'Pending',
    Compiling = 'Compiling',
    Judging = 'Judging'
}

export enum CaseStatus {
    Accepted = 'Accepted',
    WrongAnswer = 'Wrong Answer',
    PartiallyCorrect = 'Partially Correct',
    MemoryLimitExceeded = 'Memory Limit Exceeded',
    TimeLimitExceeded = 'Time Limit Exceeded',
    OutputLimitExceeded = 'Output Limit Exceeded',
    FileError = 'File Error',
    RuntimeError = 'Runtime Error',
    JudgementFailed = 'Judgement Failed',
    InvalidInteraction = 'Invalid Interaction',

    Skipped = 'Skipped',
    SystemError = 'SystemError',

    // Waiting = 'Waiting',
    Pending = 'Pending',
    Judging = 'Judging'
}

export interface JudgeTask {
    priority: number;
    taskId: taskId;
    pid: string;
    code: string;
    lang: string;
    score: number;
    // extraData?: Buffer;
    judgeState: JudgeState;
}

export interface JudgeState {
    status: JudgeStateStatus;
    errorMessage?: string;
    subtasks: SubtaskState[];
}

export interface SubtaskState {
    score?: number;
    testcases: CaseState[];
}

export interface CaseState {
    prefix: string;
    caseStatus: CaseStatus;
    errorMessage?: string;
    detail?: CaseDetail;
}

export interface CaseDetail {
    time: number;
    memory: number;
    input?: string;
    output?: string;
    // scoringRate: number; // e.g. 0.5
    userOutput?: string;
    userError?: string;
    spjMessage?: string;
    systemMessage?: string;
}

// helper functions for JudgeState

export function setStatus(j: JudgeState, s: JudgeStateStatus) {
    switch (s) {
        case JudgeStateStatus.CompileError:
        case JudgeStateStatus.NoTestdata:
        case JudgeStateStatus.SystemError:
        case JudgeStateStatus.Unknown:
            j.subtasks.map((sub) =>
                sub.testcases.map(
                    (c) => (c.caseStatus = CaseStatus.SystemError)
                )
            );
        // fall through
        default:
            j.status = s;
    }
}

export function getStatus(j: JudgeState) {
    const cases = j.subtasks.reduce(
        (prev: CaseState[], curr) => prev.concat(curr.testcases),
        []
    );
    if (cases.every((c) => c.caseStatus === CaseStatus.Accepted)) {
        j.status = JudgeStateStatus.Accepted;
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
                j.status = c.caseStatus as unknown as JudgeStateStatus;
                break;

            case CaseStatus.Pending:
            case CaseStatus.Judging:
                j.status = JudgeStateStatus.SystemError;
        }
    }

    if (j.status === JudgeStateStatus.Judging)
        j.status = JudgeStateStatus.SystemError;
}

export function getScore(task: JudgeTask) {
    task.score = task.judgeState.subtasks.reduce(
        (prev: number, curr: SubtaskState) => prev + curr.score ?? 0,
        0
    );
}
