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

    setStatus: (s: JudgeStateStatus) => void;
    getStatus: () => void;
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
