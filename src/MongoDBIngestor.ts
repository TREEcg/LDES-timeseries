import { MongoFragment } from "@treecg/sds-storage-writer-mongo/lib/fragmentHelper";
import { Member, SDS, RelationType } from '@treecg/types';
import { Collection, Db, Document } from "mongodb";
import { AbstractIngestor, IngestorConfig, IRelation, TSIngestor } from './AbstractIngestor';
import { quadsToString } from './util';
const { MongoClient } = require("mongodb")

export interface MongoDBIngestorConfig extends IngestorConfig {
    /**
     * The name of the MongoDB Collection for the SDS metadata information.
     */
    metaCollectionName?: string

    /**
     * The name of the MongoDB Collection for the members.
     */
    dataCollectionName?: string;

    /**
     * The name of the MongoDB Collection for the relations (the buckets/fragments).
     */
    indexCollectionName?: string;


    /** 
     * The URL of the MongoDB database.
     */
    mongoDBURL?: string;

}

export class MongoDBIngestor extends AbstractIngestor {
    private metaCollectionName: string;
    private dataCollectionName: string;
    private indexCollectionName: string;
    private mongoDBURL: string;

    private mongoConnection: typeof MongoClient | undefined;
    private _db: Db | undefined;

    public constructor(config: MongoDBIngestorConfig) {
        super(config);
        this.mongoDBURL = config.mongoDBURL ?? "mongodb://localhost:27017/ldes";
        this.metaCollectionName = config.metaCollectionName ?? "meta";
        this.dataCollectionName = config.dataCollectionName ?? "data";
        this.indexCollectionName = config.indexCollectionName ?? "index";
    }

    protected get dbDataCollection(): Collection<Document> {
        if (!this.mongoConnection) {
            throw Error(`Not connected to ${this.mongoDBURL} while trying to use to the data Collection. Try \`initialise\` first.`);
        }
        return this.db.collection(this.dataCollectionName);
    }

    protected get dbIndexCollection(): Collection<Document> {
        if (!this.mongoConnection) {
            throw Error(`Not connected to ${this.mongoDBURL} while trying to use to the index Collection. Try \`initialise\` first.`);
        }
        return this.db.collection(this.indexCollectionName);
    }

    protected get dbMetaCollection(): Collection<Document> {
        if (!this.mongoConnection) {
            throw Error(`Not connected to ${this.mongoDBURL} while trying to use to the meta Collection. Try \`initialise\` first.`);
        }
        return this.db.collection(this.metaCollectionName);
    }

    protected get db(): Db {
        if (!this.mongoConnection) {
            throw Error(`Not connected to ${this.mongoDBURL}. Try \`initialise\` first.`);
        }
        return this._db!;
    }
    /**
     * Stores the metadata of the SDS stream into the Mongo Database in the meta collection.
     * 
     * @param sdsMetadata - The SDS metadata for the SDS Stream.
     */
    public async initialise(sdsMetadata?: string): Promise<void> {
        this.mongoConnection = await new MongoClient(this.mongoDBURL).connect();
        this._db = this.mongoConnection.db();

        const streamExists = await this.dbMetaCollection.findOne({ id: this.sdsStreamIdentifier });

        if (streamExists) return // log that a stream already exists so must not be initialised

        if (!sdsMetadata) throw Error("No way to create SDS metadata, can be done later maybe.")

        await this.dbMetaCollection.insertOne({ id: this.sdsStreamIdentifier, value: sdsMetadata, type: SDS.Stream }, {});
    }

    public async exit(): Promise<void> {
        await this.mongoConnection.close();
    }

    /**
     * Stores members into the Mongo Database in the data collection.
     * 
     * @param member 
     * @param timestamp 
     */
    public async storeMembers(member: Member[]): Promise<void> {
        const dataElements: { id: string, data: string, timestamp?: string }[] = []
        // todo: extract timestamp from data later by using the ldes:timestampPath from the sds:description
        member.forEach(member => {
            const id = member.id.value;
            const data = quadsToString(member.quads);

            dataElements.push({ id, data });
        })

        await this.dbDataCollection.insertMany(dataElements);
    }
    /**
     * Stores members into the Mongo Database in the index collection.
     * 
     * @param member 
     * @param timestamp 
     */
    public async createBucket(bucketIdentifier: string): Promise<void> {
        const bucket: MongoFragment = {
            id: bucketIdentifier,
            streamId: this.sdsStreamIdentifier,
            leaf: true,
            relations: [],
            count: 0,
            members: []
        }
        await this.dbIndexCollection.insertOne(bucket);
    }

    public async addMemberstoBucket(bucketIdentifier: string, memberIDs: string[]): Promise<void> {
        await this.dbIndexCollection.updateOne({ id: bucketIdentifier, streamId: this.sdsStreamIdentifier }, { "$push": { members: { "$each": memberIDs } } });
    }
    public async addRelationsToBucket(bucketIdentifier: string, relations: IRelation[]): Promise<void> {
        // TODO: handle bucket in relation not existing
        // TODO: handle bucket itself not existing
        await this.dbIndexCollection.updateOne({ id: bucketIdentifier, streamId: this.sdsStreamIdentifier }, { "$push": { relations: { "$each": relations } } });
    }
}

export class TSMongoDBIngestor extends MongoDBIngestor implements TSIngestor {


    // initializes a LDES-TS if it does not exist yet.
    // Otherwise, just starts up the database
    async instantiate(config: string): Promise<void> {
        await this.initialise(config)

        // only if the root does not exist yet
        await this.createBucket("")

        // create first window
        const date = new Date(); //TODO: replace with real value
        await this.createWindow(date.valueOf() + '', date);
        await this.addWindowToRoot(date.valueOf() + "");
    }


    async getMostRecentWindow(): Promise<string> {

        const mostRecentBucket = await this.dbIndexCollection.find({streamId:this.sdsStreamIdentifier}).sort({"start": -1}).limit(1).next();
        if (!mostRecentBucket){
            throw Error("no buckets present")
        }
        return mostRecentBucket.id;
    }

    async bucketSize(bucketIdentifier: string): Promise<number> {
        const bucket = await this.dbIndexCollection.findOne({id:bucketIdentifier,streamId:this.sdsStreamIdentifier})
        if (!bucket) {
            throw Error("Bucket not found")
        }        
        return bucket.members.length;
    }

    async createWindow(bucketIdentifier: string, start: Date, end?: Date | undefined): Promise<void> {
        await this.createBucket(bucketIdentifier);

        const windowParams: any = {
            start: start.toISOString()
        }
        if (end) {
            windowParams.end = end.toISOString()
        }
        await this.dbIndexCollection.updateOne({ streamId: this.sdsStreamIdentifier, id: bucketIdentifier }, { "$set": windowParams })
    }

    async updateWindow(bucketIdentifier: string, start: Date, end: Date): Promise<void> {
        throw new Error("Method not implemented.");
    }

    async addWindowToRoot(bucketIdentifier: string): Promise<void> {
        const date = new Date(Number(bucketIdentifier));
        await this.addRelationsToBucket("", [{
            type: RelationType.GreaterThanOrEqualTo,
            value: date.toISOString(),
            path: "http://www.w3.org/ns/sosa/resultTime", // TODO: hardcoded currently
            bucket: bucketIdentifier
        }])
    }

    async append(member: Member): Promise<void> {
        const currentWindow = await this.getMostRecentWindow();
        const bucketSize = await this.bucketSize(currentWindow);

        if (bucketSize + 1 > 50) { // TODO: replace by actual pagesize
            const memberDate = new Date() // TODO: extract from member itself
            await this.createWindow(memberDate.valueOf()+'', memberDate);
            await this.addWindowToRoot(memberDate.valueOf()+'')

            // todo: update other window its end time

        } else {
            await this.storeMember(member);
            await this.addMemberstoBucket(currentWindow, [member.id.value]);
        }
    }
    async publish(members: Member[]): Promise<void> {
        // inefficent implementation
        for (const member of members) {
            await this.append(member);
        }
        // members.forEach(async (member) => {
        //     await this.append(member);
        // })
    }
}