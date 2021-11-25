import * as mongodb from 'mongodb';
import * as fs from 'fs';
import type { Limit, Test } from './daemon/interfaces';

interface RawProblem {
    limit: Limit;
    test?: Omit<Test, 'limit'>;
}

export default class Mongo {
    #client: mongodb.MongoClient;
    #dbName: string;
    db: mongodb.Db;
    bucket: mongodb.GridFSBucket;
    problem: mongodb.Collection<RawProblem>;

    constructor(url: string, name: string) {
        this.#client = new mongodb.MongoClient(url);
        this.#dbName = name;
    }

    async connect() {
        await this.#client.connect();

        this.db = this.#client.db(this.#dbName);
        this.bucket = new mongodb.GridFSBucket(this.db);

        this.problem = this.db.collection('problem');
    }

    async getTest(pid: string): Promise<Test> {
        const prob = await this.problem.findOne({
            _id: new mongodb.ObjectId(pid),
        });
        if (!prob || !prob.test)
            throw new Error('Can not find Problem TestData');

        return { ...prob.test, limit: prob.limit };
    }

    // return a readable stream
    getFileStream(fileId: string): mongodb.GridFSBucketReadStream {
        return this.bucket.openDownloadStream(new mongodb.ObjectId(fileId));
    }

    async getFileSize(fileId: string): Promise<number> {
        const files = await this.bucket
            .find({ _id: new mongodb.ObjectId(fileId) })
            .toArray();
        if (files.length !== 1) throw new Error('Error Finding Files');
        return files[0].length;
    }

    async copyFileTo(fileId: string, path: string): Promise<void> {
        const readStream = this.getFileStream(fileId);
        const writeStream = fs.createWriteStream(path);

        readStream.pipe(writeStream);
        return new Promise((fullfilled) => {
            readStream.on('close', fullfilled);
        });
    }
}
