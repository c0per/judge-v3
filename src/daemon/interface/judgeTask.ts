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

export class JudgeTask {
    priority: number;
    taskId: taskId;
    pid: string;
    code: string;
    lang: string;
    score: number;
    // extraData?: Buffer;
    judgeState: JudgeState;
}

export class JudgeState {
    status: JudgeStateStatus = JudgeStateStatus.Waiting;
    errorMessage?: string;
    subtasks: SubtaskState[] = [];
}

export class SubtaskState {
    score?: number;
    testcases: CaseState[] = [];
}

export class CaseState {
    prefix: string;
    caseStatus: CaseStatus = CaseStatus.Pending;
    errorMessage?: string;

    detail?: CaseDetail;

    constructor(prefix: string) {
        this.prefix = prefix;
    }
}

export class CaseDetail {
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
