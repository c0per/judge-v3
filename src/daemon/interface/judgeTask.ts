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

    setStatus(s: JudgeStateStatus) {
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

    getStatus() {
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
