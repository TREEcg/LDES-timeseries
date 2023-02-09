import { MongoFragment } from "@treecg/sds-storage-writer-mongo/lib/fragmentHelper";
import { Member, SDS } from '@treecg/types';
import { Collection, Db, Document, MongoClient } from "mongodb";
import { AbstractIngestor, IngestorConfig, IRelation } from './AbstractIngestor';
import { quadsToString } from '../util/Util';

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

    private mongoConnection: MongoClient | undefined;
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

    protected async streamExists(): Promise<boolean> {
        const streamExists = await this.dbMetaCollection.findOne({ id: this.sdsStreamIdentifier });
        if (streamExists) return true
        return false
    }

    protected async getSDSMetadata(): Promise<string> {
        const metadata = await this.dbMetaCollection.findOne({ id: this.sdsStreamIdentifier });
        if (!metadata) throw Error("does not exist yet")
        return metadata.value;
    }

    protected async startConnection(): Promise<void> {
        this.mongoConnection = await new MongoClient(this.mongoDBURL).connect();
        this._db = this.mongoConnection.db();
    }
    /**
     * Stores the metadata of the SDS stream into the Mongo Database in the meta collection.
     *
     * @param sdsMetadata - The SDS metadata for the SDS Stream.
     */
    public async initialise(sdsMetadata?: string): Promise<void> {
        if (!this.mongoConnection) await this.startConnection();

        if (await this.streamExists()) return // log that a stream already exists so must not be initialised

        if (!sdsMetadata) throw Error("No way to create SDS metadata, can be done later maybe.")

        await this.dbMetaCollection.insertOne({ id: this.sdsStreamIdentifier, value: sdsMetadata, type: SDS.Stream }, {});
    }

    public async exit(): Promise<void> {
        await this.mongoConnection?.close();
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
     * Stores a bucket into the Mongo Database in the index collection.
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

    protected async bucketExists(bucketIdentifier: string): Promise<boolean> {
        const exists = await this.dbIndexCollection.findOne({ streamId: this.sdsStreamIdentifier, id: bucketIdentifier });
        if (exists) {
            return true
        }
        return false
    }
}


